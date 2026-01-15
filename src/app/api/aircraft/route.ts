import { NextResponse } from "next/server"
import { db } from "@/lib/db"

// Force dynamic rendering - this route uses request.url and database
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  
  // Get filter parameters
  const status = searchParams.get("status") || "ALL"
  const sortBy = searchParams.get("sort_by") || "days_remaining"
  const sortOrder = searchParams.get("sort_order") || "asc"
  const page = parseInt(searchParams.get("page") || "1", 10)
  const perPage = parseInt(searchParams.get("per_page") || "20", 10)
  
  // Validate inputs
  const validSortBy = ["days_remaining", "last_autoland_date", "aircraft_reg"]
  const validSortOrder = ["asc", "desc"]
  
  if (!validSortBy.includes(sortBy) || !validSortOrder.includes(sortOrder)) {
    return NextResponse.json({
      success: false,
      error: "Invalid sort parameters",
    }, { status: 400 })
  }
  
  const offset = (page - 1) * perPage
  
  try {
    // Build WHERE clause
    let whereClause = "WHERE 1=1"
    const params: any[] = []
    let paramIndex = 1
    
    if (status !== "ALL") {
      whereClause += ` AND atg.status = $${paramIndex}`
      params.push(status)
      paramIndex++
    }
    
    // Add pagination parameters
    params.push(perPage, offset)
    const limitOffset = `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    
    const orderByClause = `ORDER BY atg.${sortBy} ${sortOrder.toUpperCase()}`
    
    // Get aircraft list
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
      ${limitOffset}
    `, params)
    
    // Get total count for pagination (without LIMIT/OFFSET)
    const countParams: any[] = []
    let countParamIndex = 1
    let countWhereClause = "WHERE 1=1"
    
    if (status !== "ALL") {
      countWhereClause += ` AND atg.status = $${countParamIndex}`
      countParams.push(status)
    }
    
    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM autoland_to_go atg
      ${countWhereClause}
    `, countParams.length > 0 ? countParams : undefined)
    
    const total = parseInt(countResult.rows[0].total)
    const totalPages = Math.ceil(total / perPage)
    
    return NextResponse.json({
      success: true,
      data: {
        aircraft: result.rows,
        pagination: {
          page,
          per_page: perPage,
          total,
          total_pages: totalPages,
        },
      },
    })
  } catch (error) {
    console.error("Error fetching aircraft list:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch aircraft list",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    )
  }
}

