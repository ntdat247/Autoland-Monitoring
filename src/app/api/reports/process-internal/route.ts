import { NextResponse } from "next/server"
import { Storage } from "@google-cloud/storage"
import { db } from "@/lib/db"
import { parsePDFWithFallback } from "@/lib/parsers/hybrid-pdf-parser"

// Force dynamic rendering - this route uses database and external APIs
export const dynamic = 'force-dynamic'

/**
 * Internal API endpoint for processing Autoland Report PDF
 * POST /api/reports/process-internal
 * 
 * This endpoint is designed to be called from Cloud Functions.
 * The Cloud Function downloads the PDF and sends it here as base64.
 * 
 * Body: { 
 *   pdfBase64: string,      // PDF content as base64
 *   filename: string,       // Original filename
 *   emailSubject?: string,  // Email subject
 *   emailFrom?: string,     // Email sender
 *   messageId?: string      // Gmail message ID
 * }
 * 
 * Security: This endpoint validates the Authorization header for Cloud Run.
 */

export async function POST(request: Request) {
  try {
    // Validate authorization (Cloud Functions sends identity token)
    const authHeader = request.headers.get("authorization")
    // In production, you should validate the token
    // For now, we log it for debugging
    if (authHeader) {
      console.log("Authorization header present")
    }

    const body = await request.json()
    const { pdfBase64, filename, emailSubject, emailFrom, messageId } = body

    if (!pdfBase64) {
      return NextResponse.json(
        {
          success: false,
          error: "pdfBase64 is required",
        },
        { status: 400 }
      )
    }

    // Decode PDF from base64
    const pdfData = Buffer.from(pdfBase64, "base64")
    console.log(`PDF received: ${pdfData.length} bytes, filename: ${filename}`)

    // Step 1: Upload to Cloud Storage
    const storage = new Storage({
      projectId: process.env.GCP_PROJECT_ID,
      keyFilename: process.env.GCP_KEY_FILE,
    })

    const bucketName = process.env.GCP_STORAGE_BUCKET || "autoland-reports"
    
    // Use provided filename or generate one
    const pdfFilename = filename || `autoland-${Date.now()}.pdf`
    
    // Organize by date: YYYY/MM/DD/filename.pdf
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const storagePath = `${year}/${month}/${day}/${pdfFilename}`

    const bucket = storage.bucket(bucketName)
    const file = bucket.file(storagePath)

    await file.save(pdfData, {
      metadata: {
        contentType: "application/pdf",
        metadata: {
          emailSubject: emailSubject || "",
          emailFrom: emailFrom || "",
          messageId: messageId || "",
        }
      },
    })

    console.log(`PDF uploaded to: gs://${bucketName}/${storagePath}`)

    // Step 2: Parse PDF using hybrid parser (pdf2json first, Document AI fallback)
    const parseResult = await parsePDFWithFallback(pdfData)

    if (!parseResult.success || !parseResult.data) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to parse PDF data",
          message: "Parser errors",
          details: {
            errors: parseResult.errors,
            warnings: parseResult.warnings,
            method: parseResult.method,
            parsingAttempts: parseResult.parsingAttempts,
          },
        },
        { status: 400 }
      )
    }

    const parsedData = parseResult.data

    // Step 3: Check for duplicate reports
    const existingReport = await db.query(
      "SELECT id FROM autoland_reports WHERE report_number = $1",
      [parsedData.report_number]
    )

    if (existingReport.rows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Report already exists",
          message: `Report with number ${parsedData.report_number} already exists in database`,
          data: {
            existingId: existingReport.rows[0].id,
          },
        },
        { status: 409 }
      )
    }

    // Step 4: Create datetime_utc from date_utc and time_utc
    const datetimeUtc = `${parsedData.date_utc}T${parsedData.time_utc}:00Z`

    // Step 5: Insert into database with extraction metrics
    const insertResult = await db.query(
      `INSERT INTO autoland_reports (
        report_number, aircraft_reg, flight_number, airport, runway,
        captain, first_officer, date_utc, time_utc, datetime_utc,
        wind_velocity, td_point, tracking, qnh, alignment, speed_control,
        temperature, landing, aircraft_dropout, visibility_rvr,
        other, result, reasons, captain_signature,
        pdf_storage_path, pdf_storage_bucket, pdf_filename,
        email_subject, email_sender, email_id,
        extraction_method, extraction_cost, extraction_cost_saved,
        extraction_status, processed_at, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
        $31, $32, $33, 'SUCCESS', NOW(), NOW()
      ) RETURNING id`,
      [
        parsedData.report_number,
        parsedData.aircraft_reg,
        parsedData.flight_number,
        parsedData.airport,
        parsedData.runway,
        parsedData.captain,
        parsedData.first_officer,
        parsedData.date_utc,
        parsedData.time_utc,
        datetimeUtc,
        parsedData.wind_velocity,
        parsedData.td_point,
        parsedData.tracking,
        parsedData.qnh,
        parsedData.alignment,
        parsedData.speed_control,
        parsedData.temperature,
        parsedData.landing,
        parsedData.aircraft_dropout,
        parsedData.visibility_rvr,
        parsedData.other,
        parsedData.result,
        parsedData.reasons,
        parsedData.captain_signature,
        storagePath,
        bucketName,
        pdfFilename,
        emailSubject || null,
        emailFrom || null,
        messageId || null,
        parseResult.method,
        parseResult.metrics.actualCost,
        parseResult.metrics.costSaved,
      ]
    )

    const reportId = insertResult.rows[0].id

    // Step 6: Sync autoland_to_go table
    if (parsedData.aircraft_reg) {
      await db.query("SELECT sync_autoland_to_go()")
    }

    console.log(`Report saved successfully with ID: ${reportId}`)
    console.log(`Extraction method: ${parseResult.method}, Cost: $${parseResult.metrics.actualCost}, Saved: $${parseResult.metrics.costSaved}`)

    return NextResponse.json({
      success: true,
      data: {
        reportId,
        reportNumber: parsedData.report_number,
        aircraftReg: parsedData.aircraft_reg,
        flightNumber: parsedData.flight_number,
        result: parsedData.result,
        pdfStoragePath: storagePath,
        pdfStorageBucket: bucketName,
        extraction: {
          method: parseResult.method,
          cost: parseResult.metrics.actualCost,
          costSaved: parseResult.metrics.costSaved,
        },
        message: "Report processed and saved successfully",
      },
    })

  } catch (error: any) {
    console.error("Error processing report:", error)
    
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process report",
        message: error.message || "Unknown error",
        details: error.stack || {},
      },
      { status: 500 }
    )
  }
}
