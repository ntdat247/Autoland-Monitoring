import { NextResponse } from "next/server"
import { db } from "@/lib/db"

// Force dynamic rendering - this route uses request.url and database
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  
  // Get filter and pagination parameters
  const aircraftReg = searchParams.get("aircraft_reg") || undefined
  const dateFrom = searchParams.get("date_from") || undefined
  const dateTo = searchParams.get("date_to") || undefined
  const result = searchParams.get("result") || "ALL"
  const search = searchParams.get("search") || undefined
  const sortBy = searchParams.get("sort_by") || "date_utc"
  const sortOrder = searchParams.get("sort_order") || "desc"
  const page = parseInt(searchParams.get("page") || "1", 10)
  const perPage = parseInt(searchParams.get("per_page") || "20", 10)
  
  // Validate inputs
  const validSortBy = ["date_utc", "aircraft_reg", "result", "captain"]
  const validSortOrder = ["asc", "desc"]
  const validResult = ["SUCCESSFUL", "UNSUCCESSFUL", "ALL"]
  
  if (!validSortBy.includes(sortBy) || !validSortOrder.includes(sortOrder) || !validResult.includes(result)) {
    return NextResponse.json({
      success: false,
      error: "Invalid filter parameters",
    }, { status: 400 })
  }
  
  const offset = (page - 1) * perPage
  
  try {
    // Build WHERE clause and parameters
    let whereClause = "WHERE 1=1"
    const params: any[] = []
    let paramIndex = 1
    
    // Aircraft filter
    if (aircraftReg) {
      whereClause += ` AND ar.aircraft_reg = $${paramIndex}`
      params.push(aircraftReg)
      paramIndex++
    }
    
    // Date range filter
    if (dateFrom) {
      whereClause += ` AND ar.date_utc >= $${paramIndex}`
      params.push(dateFrom)
      paramIndex++
    }
    
    if (dateTo) {
      whereClause += ` AND ar.date_utc <= $${paramIndex}`
      params.push(dateTo)
      paramIndex++
    }
    
    // Result filter
    if (result !== "ALL") {
      whereClause += ` AND ar.result = $${paramIndex}`
      params.push(result)
      paramIndex++
    }
    
    // Search filter (search in report_number, captain, flight_number)
    if (search) {
      const searchPattern = `%${search}%`
      whereClause += ` AND (ar.report_number ILIKE $${paramIndex} OR ar.captain ILIKE $${paramIndex} OR ar.flight_number ILIKE $${paramIndex})`
      params.push(searchPattern)
      paramIndex++
    }
    
    // Add pagination parameters
    params.push(perPage, offset)
    const limitOffset = `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    
    const orderByClause = `ORDER BY ar.${sortBy} ${sortOrder.toUpperCase()}`
    
    // Get reports list
    const resultQuery = await db.query(`
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
        ar.time_utc,
        ar.datetime_utc,
        ar.wind_velocity,
        ar.td_point,
        ar.tracking,
        ar.qnh,
        ar.alignment,
        ar.speed_control,
        ar.temperature,
        ar.landing,
        ar.aircraft_dropout,
        ar.visibility_rvr,
        ar.other,
        ar.result,
        ar.reasons,
        ar.captain_signature,
        ar.pdf_filename,
        ar.pdf_storage_path,
        ar.pdf_storage_bucket,
        ar.processed_at,
        ar.extraction_status
      FROM autoland_reports ar
      ${whereClause}
      ${orderByClause}
      ${limitOffset}
    `, params)
    
    // Get total count for pagination (without LIMIT/OFFSET)
    const countParams: any[] = []
    let countParamIndex = 1
    let countWhereClause = "WHERE 1=1"
    
    if (aircraftReg) {
      countWhereClause += ` AND ar.aircraft_reg = $${countParamIndex}`
      countParams.push(aircraftReg)
      countParamIndex++
    }
    
    if (dateFrom) {
      countWhereClause += ` AND ar.date_utc >= $${countParamIndex}`
      countParams.push(dateFrom)
      countParamIndex++
    }
    
    if (dateTo) {
      countWhereClause += ` AND ar.date_utc <= $${countParamIndex}`
      countParams.push(dateTo)
      countParamIndex++
    }
    
    if (result !== "ALL") {
      countWhereClause += ` AND ar.result = $${countParamIndex}`
      countParams.push(result)
      countParamIndex++
    }
    
    if (search) {
      const searchPattern = `%${search}%`
      countWhereClause += ` AND (ar.report_number ILIKE $${countParamIndex} OR ar.captain ILIKE $${countParamIndex} OR ar.flight_number ILIKE $${countParamIndex})`
      countParams.push(searchPattern)
    }
    
    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM autoland_reports ar
      ${countWhereClause}
    `, countParams.length > 0 ? countParams : undefined)
    
    const total = parseInt(countResult.rows[0].total)
    const totalPages = Math.ceil(total / perPage)
    
    return NextResponse.json({
      success: true,
      data: {
        reports: resultQuery.rows,
        filters: {
          aircraft_reg: aircraftReg,
          date_from: dateFrom,
          date_to: dateTo,
          result,
          search,
        },
        pagination: {
          page,
          per_page: perPage,
          total,
          total_pages: totalPages,
        },
      },
    })
  } catch (error) {
    console.error("Error fetching reports list:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch reports list",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    )
  }
}

