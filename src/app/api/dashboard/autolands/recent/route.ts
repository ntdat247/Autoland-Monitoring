import { NextResponse } from "next/server"
import { db } from "@/lib/db"

// Force dynamic rendering - this route uses request.url and database
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // Get query params
    const { searchParams } = new URL(request.url ?? "")
    const limit = parseInt(searchParams.get("limit") || "10", 10)
    const maxLimit = Math.min(limit, 100) // Cap at 100 for performance
    const sortBy = searchParams.get("sort_by") || "date_utc"
    const sortOrder = searchParams.get("sort_order") || "desc"
    const search = searchParams.get("search") || ""
    const aircraftReg = searchParams.get("aircraft_reg") || undefined
    const dateFrom = searchParams.get("date_from") || undefined
    const dateTo = searchParams.get("date_to") || undefined
    const resultFilter = searchParams.get("result") || "ALL"

    // Validate sort parameters
    const validSortBy = ["date_utc", "aircraft_reg", "flight_number", "airport", "captain", "result", "days_remaining"]
    const validSortOrder = ["asc", "desc"]
    const validResult = ["SUCCESSFUL", "UNSUCCESSFUL", "ALL"]

    if (!validSortBy.includes(sortBy) || !validSortOrder.includes(sortOrder) || !validResult.includes(resultFilter)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid filter parameters",
        },
        { status: 400 }
      )
    }

    // Build WHERE clause for filters
    let whereClause = "WHERE 1=1"
    const queryParams: any[] = []
    let paramIndex = 1

    // Aircraft filter
    if (aircraftReg) {
      whereClause += ` AND ar.aircraft_reg = $${paramIndex}`
      queryParams.push(aircraftReg)
      paramIndex++
    }

    // Date range filter
    if (dateFrom) {
      whereClause += ` AND ar.date_utc >= $${paramIndex}`
      queryParams.push(dateFrom)
      paramIndex++
    }

    if (dateTo) {
      whereClause += ` AND ar.date_utc <= $${paramIndex}`
      queryParams.push(dateTo)
      paramIndex++
    }

    // Result filter
    if (resultFilter !== "ALL") {
      whereClause += ` AND ar.result = $${paramIndex}`
      queryParams.push(resultFilter)
      paramIndex++
    }

    // Search filter (search in report_number, captain, flight_number, aircraft_reg, airport)
    if (search) {
      const searchPattern = `%${search}%`
      whereClause += ` AND (ar.aircraft_reg ILIKE $${paramIndex} OR ar.flight_number ILIKE $${paramIndex} OR ar.captain ILIKE $${paramIndex} OR ar.airport ILIKE $${paramIndex} OR ar.report_number ILIKE $${paramIndex})`
      queryParams.push(searchPattern)
      paramIndex++
    }

    // Build ORDER BY clause
    let orderByClause = ""
    if (sortBy === "days_remaining") {
      orderByClause = `ORDER BY days_remaining ${sortOrder.toUpperCase()}`
    } else {
      orderByClause = `ORDER BY ar.${sortBy} ${sortOrder.toUpperCase()}`
      // Add secondary sort for date_utc if not already primary
      if (sortBy !== "date_utc") {
        orderByClause += `, ar.date_utc DESC`
      } else {
        orderByClause += `, ar.datetime_utc DESC`
      }
    }

    // Fetch recent autolands with "To Go" information
    // Calculate next_required_date = date_utc + 30 days
    // Calculate days_remaining = next_required_date - CURRENT_DATE
    const result = await db.query(`
      SELECT 
        ar.id,
        ar.report_number,
        ar.aircraft_reg,
        ar.flight_number,
        ar.airport,
        ar.runway,
        ar.date_utc,
        ar.time_utc,
        ar.result,
        ar.captain,
        ar.first_officer,
        ar.datetime_utc,
        ar.td_point,
        ar.tracking,
        ar.visibility_rvr,
        ar.pdf_filename,
        ar.pdf_storage_path,
        ar.pdf_storage_bucket,
        (ar.date_utc + INTERVAL '30 days')::date as next_required_date,
        ((ar.date_utc + INTERVAL '30 days')::date - CURRENT_DATE)::integer as days_remaining,
        CASE
          WHEN ((ar.date_utc + INTERVAL '30 days')::date - CURRENT_DATE) < 0 THEN 'OVERDUE'
          WHEN ((ar.date_utc + INTERVAL '30 days')::date - CURRENT_DATE) <= 7 THEN 'DUE_SOON'
          ELSE 'ON_TIME'
        END as status
      FROM autoland_reports ar
      ${whereClause}
      ${orderByClause}
      LIMIT $${paramIndex}
    `, [...queryParams, maxLimit])

    return NextResponse.json({
      success: true,
      data: result.rows,
    })
  } catch (error) {
    console.error("Error fetching recent autolands:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch recent autolands",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    )
  }
}

