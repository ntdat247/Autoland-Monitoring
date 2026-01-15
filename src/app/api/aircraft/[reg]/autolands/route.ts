import { NextResponse } from "next/server"
import { db } from "@/lib/db"

// Force dynamic rendering - this route uses request.url and database
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: {
    reg: string
  }
}

export async function GET(
  request: Request,
  { params }: RouteParams
) {
  const { reg } = params
  const { searchParams } = new URL(request.url)
  
  // Get pagination parameters
  const limit = parseInt(searchParams.get("limit") || "20", 10)
  const offset = parseInt(searchParams.get("offset") || "0", 10)
  
  // Validate aircraft registration format
  const aircraftRegRegex = /^VN-A\d{4}$/
  if (!aircraftRegRegex.test(reg)) {
    return NextResponse.json({
      success: false,
      error: "Invalid aircraft registration format. Expected format: VN-A525",
    }, { status: 400 })
  }
  
  try {
    // Get autoland history for aircraft
    const result = await db.query(`
      SELECT 
        ar.id,
        ar.report_number,
        ar.aircraft_reg,
        ar.flight_number,
        ar.airport,
        ar.runway,
        ar.captain,
        ar.first_officer,
        ar.date_utc,
        ar.datetime_utc,
        ar.result,
        ar.captain_signature,
        ar.pdf_filename,
        ar.pdf_storage_path
        ar.pdf_storage_bucket,
        ar.processed_at,
        ar.extraction_status
      FROM autoland_reports ar
      WHERE ar.aircraft_reg = $1
      ORDER BY ar.date_utc DESC, ar.datetime_utc DESC
      LIMIT $${limit}
      OFFSET $${offset}
    `, [reg])
    
    return NextResponse.json({
      success: true,
      data: {
        autolands: result.rows,
        pagination: {
          limit,
          offset,
        },
      },
    })
  } catch (error) {
    console.error("Error fetching aircraft autolands:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch aircraft autolands",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    )
  }
}


