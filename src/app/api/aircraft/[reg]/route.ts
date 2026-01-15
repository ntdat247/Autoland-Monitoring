import { NextResponse } from "next/server"
import { db } from "@/lib/db"

// Force dynamic rendering - this route uses dynamic params and database
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
  
  // Validate aircraft registration format
  const aircraftRegRegex = /^VN-A\d{4}$/
  if (!aircraftRegRegex.test(reg)) {
    return NextResponse.json({
      success: false,
      error: "Invalid aircraft registration format. Expected format: VN-A525",
    }, { status: 400 })
  }
  
  try {
    // Get aircraft detail
    const result = await db.query(`
      SELECT 
        atg.id,
        atg.aircraft_reg,
        atg.last_autoland_date,
        atg.last_autoland_report_id,
        atg.next_required_date,
        atg.days_remaining,
        atg.status,
        atg.updated_at
      FROM autoland_to_go atg
      WHERE atg.aircraft_reg = $1
    `, [reg])
    
    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Aircraft not found",
      }, { status: 404 })
    }
    
    return NextResponse.json({
      success: true,
      data: {
        aircraft: result.rows[0],
      },
    })
  } catch (error) {
    console.error("Error fetching aircraft detail:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch aircraft detail",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    )
  }
}


