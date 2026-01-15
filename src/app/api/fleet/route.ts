import { NextResponse } from "next/server"
import { db } from "@/lib/db"

// Force dynamic rendering - this route uses request.url and database
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  
  // Get filter parameters
  const status = searchParams.get("status") || "ALL"
  const station = searchParams.get("station") || undefined
  const sortBy = searchParams.get("sort_by") || "days_remaining"
  const sortOrder = searchParams.get("sort_order") || "asc"
  
  // Validate inputs
  const validSortBy = ["days_remaining", "last_autoland_date", "aircraft_reg"]
  const validSortOrder = ["asc", "desc"]
  const validStatus = ["ON_TIME", "DUE_SOON", "OVERDUE", "ALL"]
  
  if (!validSortBy.includes(sortBy) || !validSortOrder.includes(sortOrder) || !validStatus.includes(status)) {
    return NextResponse.json({
      success: false,
      error: "Invalid filter parameters",
    }, { status: 400 })
  }
  
  try {
    // Build WHERE clause
    let whereClause = "WHERE 1=1"
    
    // Status filter
    if (status !== "ALL") {
      whereClause += ` AND atg.status = '${status}'`
    }
    
    // Station filter (if applicable - filter by airport in recent reports)
    // Note: This would require JOIN with autoland_reports
    // For now, we'll implement basic status filtering
    
    const orderByClause = `ORDER BY atg.${sortBy} ${sortOrder.toUpperCase()}`
    
    // Get fleet overview
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
      ${whereClause}
      ${orderByClause}
    `, [])
    
    return NextResponse.json({
      success: true,
      data: {
        fleet: result.rows,
        filters: {
          status,
          station,
        },
      },
    })
  } catch (error) {
    console.error("Error fetching fleet overview:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch fleet overview",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    )
  }
}


