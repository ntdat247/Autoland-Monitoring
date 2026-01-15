import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { Storage } from "@google-cloud/storage"

// Force dynamic rendering - this route uses request.url and database
export const dynamic = 'force-dynamic'

/**
 * Cleanup old PDF files from Google Cloud Storage
 * Deletes PDF files older than 30 days to save storage costs
 * 
 * GET /api/storage/cleanup?days=30
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const daysParam = searchParams.get("days")
    const retentionDays = daysParam ? parseInt(daysParam, 10) : 30

    if (isNaN(retentionDays) || retentionDays < 1) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid days parameter",
          message: "Days must be a positive number",
        },
        { status: 400 }
      )
    }

    // Check if GCP credentials are available
    if (!process.env.GCP_PROJECT_ID || !process.env.GCP_KEY_FILE) {
      return NextResponse.json(
        {
          success: false,
          error: "GCP credentials not configured",
          message: "GCP_PROJECT_ID and GCP_KEY_FILE are required",
        },
        { status: 500 }
      )
    }

    // Initialize Google Cloud Storage
    const storage = new Storage({
      projectId: process.env.GCP_PROJECT_ID,
      keyFilename: process.env.GCP_KEY_FILE,
    })

    // Calculate cutoff date
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    console.log(`Starting cleanup: Deleting PDFs older than ${retentionDays} days (before ${cutoffDate.toISOString()})`)

    // Find reports older than retentionDays
    const oldReports = await db.query(
      `SELECT id, pdf_storage_path, pdf_storage_bucket, pdf_filename, date_utc
       FROM autoland_reports
       WHERE date_utc < $1
       AND pdf_storage_path IS NOT NULL
       AND pdf_storage_bucket IS NOT NULL
       ORDER BY date_utc ASC`,
      [cutoffDate]
    )

    const reportsToDelete = oldReports.rows
    console.log(`Found ${reportsToDelete.length} reports older than ${retentionDays} days`)

    let deletedCount = 0
    let failedCount = 0
    const errors: string[] = []

    // Delete PDF files from storage
    for (const report of reportsToDelete) {
      try {
        const bucketName = report.pdf_storage_bucket
        let filePath = report.pdf_storage_path

        // Remove gs:// prefix if present
        if (filePath.startsWith('gs://')) {
          const gsPrefix = `gs://${bucketName}/`
          if (filePath.startsWith(gsPrefix)) {
            filePath = filePath.substring(gsPrefix.length)
          } else {
            const parts = filePath.split('/')
            filePath = parts.slice(2).join('/')
          }
        }

        const bucket = storage.bucket(bucketName)
        const file = bucket.file(filePath)

        // Check if file exists
        const [exists] = await file.exists()
        if (exists) {
          await file.delete()
          console.log(`Deleted PDF: ${filePath} (Report ID: ${report.id})`)
          deletedCount++
        } else {
          console.log(`PDF not found in storage: ${filePath} (Report ID: ${report.id})`)
        }

        // Update database to mark PDF as deleted (optional - keep record but remove file reference)
        // Or you can choose to delete the entire report record
        await db.query(
          `UPDATE autoland_reports 
           SET pdf_storage_path = NULL,
               pdf_storage_bucket = NULL,
               pdf_filename = NULL,
               extraction_errors = COALESCE(extraction_errors || E'\n', '') || 'PDF file deleted during cleanup',
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [report.id]
        )

      } catch (error: any) {
        failedCount++
        const errorMsg = `Failed to delete PDF for report ${report.id}: ${error.message}`
        errors.push(errorMsg)
        console.error(errorMsg, error)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        retentionDays,
        cutoffDate: cutoffDate.toISOString(),
        totalReportsFound: reportsToDelete.length,
        deletedCount,
        failedCount,
        errors: errors.length > 0 ? errors : undefined,
      },
      message: `Cleanup completed: ${deletedCount} PDF files deleted, ${failedCount} failed`,
    })
  } catch (error: any) {
    console.error("Cleanup error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to cleanup storage",
        message: error.message,
        details: error,
      },
      { status: 500 }
    )
  }
}

