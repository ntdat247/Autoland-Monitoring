import { NextResponse } from "next/server"
import { Storage } from "@google-cloud/storage"
import { db } from "@/lib/db"

// Force dynamic rendering - this route uses dynamic params and database
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: {
    id: string
  }
}

export async function GET(
  request: Request,
  { params }: RouteParams
) {
  const { id } = params
  
  // Validate report ID
  const reportId = parseInt(id, 10)
  if (isNaN(reportId)) {
    return NextResponse.json({
      success: false,
      error: "Invalid report ID",
    }, { status: 400 })
  }
  
  try {
    // Get report PDF path from database
    const result = await db.query(`
      SELECT 
        ar.pdf_storage_path,
        ar.pdf_storage_bucket,
        ar.pdf_filename
      FROM autoland_reports ar
      WHERE ar.id = $1
    `, [reportId])
    
    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Report not found",
      }, { status: 404 })
    }
    
    const report = result.rows[0]
    
    // Check if GCP credentials are available
    if (!report.pdf_storage_bucket || !report.pdf_storage_path) {
      return NextResponse.json({
        success: false,
        error: "PDF file not available in storage",
      }, { status: 404 })
    }
    
    // Initialize Google Cloud Storage
    // Use default credentials if keyFilename is not provided (for Cloud Run, etc.)
    const storageOptions: any = {}
    if (process.env.GCP_PROJECT_ID) {
      storageOptions.projectId = process.env.GCP_PROJECT_ID
    }
    if (process.env.GCP_KEY_FILE) {
      storageOptions.keyFilename = process.env.GCP_KEY_FILE
    }
    
    const storage = new Storage(storageOptions)
    
    // Extract file path (remove gs:// prefix if present)
    let filePath = report.pdf_storage_path
    if (filePath.startsWith('gs://')) {
      // Remove gs://bucket/ prefix
      const gsPrefix = `gs://${report.pdf_storage_bucket}/`
      if (filePath.startsWith(gsPrefix)) {
        filePath = filePath.substring(gsPrefix.length)
      } else {
        // Extract path after gs://
        const parts = filePath.split('/')
        filePath = parts.slice(2).join('/')
      }
    }
    
    // Get file reference from bucket
    const fileRef = storage.bucket(report.pdf_storage_bucket).file(filePath)
    
    // Check if file exists
    const [exists] = await fileRef.exists()
    if (!exists) {
      return NextResponse.json({
        success: false,
        error: "PDF file not found in storage",
      }, { status: 404 })
    }
    
    // Download PDF file buffer
    const [fileBuffer] = await fileRef.download()
    
    // Set response headers
    const headers = new Headers()
    headers.set("Content-Type", "application/pdf")
    headers.set("Content-Disposition", `attachment; filename="${report.pdf_filename}"`)
    
    // Convert Buffer to Uint8Array for NextResponse compatibility
    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error("Error downloading PDF:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to download PDF",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    )
  }
}

