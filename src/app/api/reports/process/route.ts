import { NextResponse } from "next/server"
import { google } from "googleapis"
import { Storage } from "@google-cloud/storage"
import { db } from "@/lib/db"
import { parsePDFWithFallback } from "@/lib/parsers/hybrid-pdf-parser"

// Force dynamic rendering - this route uses database and external APIs
export const dynamic = 'force-dynamic'

/**
 * Process Autoland Report PDF and save to database
 * POST /api/reports/process
 * 
 * Body: { messageId: string, attachmentId: string }
 * Headers: Authorization: Bearer <access_token>
 * 
 * Steps:
 * 1. Download PDF từ Gmail attachment
 * 2. Upload PDF lên Cloud Storage
 * 3. Extract text từ PDF bằng Document AI
 * 4. Parse extracted text để lấy structured data
 * 5. Lưu vào database autoland_reports
 * 6. Cập nhật autoland_to_go table
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { messageId, attachmentId } = body

    if (!messageId || !attachmentId) {
      return NextResponse.json(
        {
          success: false,
          error: "messageId and attachmentId are required",
        },
        { status: 400 }
      )
    }

    // Step 1: Initialize Gmail API
    const authHeader = request.headers.get("authorization")
    const accessToken = authHeader?.replace("Bearer ", "")

    let gmail: any

    if (accessToken) {
      const auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/test/gmail/callback"
      )
      auth.setCredentials({ access_token: accessToken })
      gmail = google.gmail({ version: "v1", auth })
    } else if (process.env.GCP_KEY_FILE && process.env.GCP_PROJECT_ID) {
      const gmailAuth = new google.auth.GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
        keyFile: process.env.GCP_KEY_FILE,
        projectId: process.env.GCP_PROJECT_ID,
      })
      
      if (process.env.GMAIL_USER) {
        const authClient = await gmailAuth.getClient() as any
        authClient.subject = process.env.GMAIL_USER
        gmail = google.gmail({ version: "v1", auth: authClient })
      } else {
        gmail = google.gmail({ version: "v1", auth: gmailAuth })
      }
    } else {
      return NextResponse.json(
        {
          success: false,
          error: "No authentication method configured",
          message: "Please provide OAuth2 access token in Authorization header, or configure GCP_KEY_FILE and GCP_PROJECT_ID",
        },
        { status: 401 }
      )
    }

    // Step 2: Get message details for metadata
    const message = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "metadata",
      metadataHeaders: ["Subject", "From", "Date"],
    })

    const emailSubject = message.data.payload?.headers?.find((h: any) => h.name === "Subject")?.value || ""
    const emailSender = message.data.payload?.headers?.find((h: any) => h.name === "From")?.value || ""
    const emailDate = message.data.payload?.headers?.find((h: any) => h.name === "Date")?.value || ""

    // Step 3: Download PDF attachment
    console.log(`Downloading attachment ${attachmentId} from message ${messageId}`)
    const attachment = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId: messageId,
      id: attachmentId,
    })

    const pdfData = Buffer.from(attachment.data.data!, "base64")
    console.log(`PDF downloaded: ${pdfData.length} bytes`)

    // Step 4: Upload to Cloud Storage
    const storage = new Storage({
      projectId: process.env.GCP_PROJECT_ID,
      keyFilename: process.env.GCP_KEY_FILE,
    })

    const bucketName = process.env.GCP_STORAGE_BUCKET || "autoland-reports-test"
    
    // Extract filename from email subject or use timestamp
    const pdfFilename = emailSubject.match(/([A-Z0-9_-]+\.pdf)/i)?.[1] || 
                       `autoland-${Date.now()}.pdf`
    
    // Organize by date: YYYY/MM/DD/filename.pdf
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const fileName = `${year}/${month}/${day}/${pdfFilename}`

    const bucket = storage.bucket(bucketName)
    const file = bucket.file(fileName)

    await file.save(pdfData, {
      metadata: {
        contentType: "application/pdf",
      },
    })

    console.log(`PDF uploaded to: gs://${bucketName}/${fileName}`)

    // Step 5: Extract & Parse using Hybrid Parser (pdf2json -> Document AI fallback)
    console.log(`Processing PDF with Hybrid Parser (pdf2json -> Document AI fallback)`)

    const hybridResult = await parsePDFWithFallback(pdfData)

    if (!hybridResult.success || !hybridResult.data) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to parse PDF data",
          message: "Hybrid parser errors",
          details: {
            method: hybridResult.method,
            errors: hybridResult.errors,
            warnings: hybridResult.warnings,
            metrics: hybridResult.metrics,
          },
        },
        { status: 400 }
      )
    }

    const parsed = hybridResult.data
    console.log(`PDF processed successfully using: ${hybridResult.method}`)
    console.log(`Cost: $${hybridResult.metrics.actualCost.toFixed(4)} | Saved: $${hybridResult.metrics.costSaved.toFixed(4)}`)

    // Step 7: Check if report already exists (by report_number)
    const existingReport = await db.query(
      `SELECT id FROM autoland_reports WHERE report_number = $1`,
      [parsed.report_number]
    )

    if (existingReport.rows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Report already exists",
          message: `Report with number ${parsed.report_number} already exists in database`,
          data: {
            existingId: existingReport.rows[0].id,
          },
        },
        { status: 409 }
      )
    }

    // Step 8: Save to database with hybrid parser metrics
    const insertResult = await db.query(
      `INSERT INTO autoland_reports (
        report_number, aircraft_reg, flight_number,
        airport, runway, captain, first_officer,
        date_utc, time_utc, datetime_utc,
        wind_velocity, td_point, tracking, qnh, alignment, speed_control,
        temperature, landing, aircraft_dropout, visibility_rvr, other,
        result, reasons, captain_signature,
        email_id, email_subject, email_sender, email_received_time,
        pdf_filename, pdf_storage_path, pdf_storage_bucket,
        extraction_status, extraction_method, extraction_cost, extraction_cost_saved,
        raw_extracted_text
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21,
        $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36
      ) RETURNING id`,
      [
        parsed.report_number,
        parsed.aircraft_reg,
        parsed.flight_number,
        parsed.airport,
        parsed.runway,
        parsed.captain,
        parsed.first_officer,
        parsed.date_utc,
        parsed.time_utc,
        parsed.datetime_utc,
        parsed.wind_velocity,
        parsed.td_point,
        parsed.tracking,
        parsed.qnh,
        parsed.alignment,
        parsed.speed_control,
        parsed.temperature,
        parsed.landing,
        parsed.aircraft_dropout,
        parsed.visibility_rvr,
        parsed.other,
        parsed.result,
        parsed.reasons,
        parsed.captain_signature,
        messageId,
        emailSubject,
        emailSender,
        emailDate ? new Date(emailDate) : null,
        pdfFilename,
        fileName, // Store path without gs:// prefix
        bucketName,
        hybridResult.errors.length > 0 ? 'PARTIAL' : 'SUCCESS',
        hybridResult.method,
        hybridResult.metrics.actualCost,
        hybridResult.metrics.costSaved,
        '', // Raw text not stored to save space - can be extracted from PDF if needed
      ]
    )

    const reportId = insertResult.rows[0].id
    console.log(`Report saved to database with ID: ${reportId}`)

    // Step 9: Update autoland_to_go table
    // Use the database function to calculate and update
    await db.query(
      `INSERT INTO autoland_to_go (
        aircraft_reg, last_autoland_date, last_autoland_report_id,
        next_required_date, days_remaining, status
      )
      SELECT
        $1,
        last_autoland_date,
        last_autoland_report_id,
        next_required_date,
        days_remaining,
        status
      FROM calculate_autoland_to_go($1)
      ON CONFLICT (aircraft_reg) DO UPDATE SET
        last_autoland_date = EXCLUDED.last_autoland_date,
        last_autoland_report_id = EXCLUDED.last_autoland_report_id,
        next_required_date = EXCLUDED.next_required_date,
        days_remaining = EXCLUDED.days_remaining,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
      WHERE autoland_to_go.aircraft_reg = $1`,
      [parsed.aircraft_reg]
    )

    console.log(`Updated autoland_to_go for aircraft: ${parsed.aircraft_reg}`)

    return NextResponse.json({
      success: true,
      data: {
        reportId,
        reportNumber: parsed.report_number,
        aircraftReg: parsed.aircraft_reg,
        flightNumber: parsed.flight_number,
        date: parsed.date_utc,
        result: parsed.result,
        storagePath: `gs://${bucketName}/${fileName}`,
        warnings: hybridResult.warnings,
      },
      message: "Report processed and saved successfully",
    })
  } catch (error) {
    console.error("Report Processing Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process report",
        message: error instanceof Error ? error.message : "Unknown error occurred",
        details: error,
      },
      { status: 500 }
    )
  }
}

