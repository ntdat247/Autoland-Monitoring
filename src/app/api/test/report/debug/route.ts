import { NextResponse } from "next/server"
import { db } from "@/lib/db"

// Force dynamic rendering - this route uses request.url and database
export const dynamic = 'force-dynamic'

/**
 * Debug endpoint to see what data was actually saved in database
 * GET /api/test/report/debug?id=38
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const reportId = searchParams.get("id")

    if (!reportId) {
      return NextResponse.json(
        {
          success: false,
          error: "Report ID is required",
        },
        { status: 400 }
      )
    }

    // Query report from database
    const result = await db.query(
      `SELECT 
        id, report_number, aircraft_reg, flight_number,
        airport, runway, captain, first_officer,
        date_utc, time_utc, datetime_utc,
        wind_velocity, td_point, tracking, qnh,
        alignment, speed_control, temperature, landing,
        aircraft_dropout, visibility_rvr, other,
        result, reasons, captain_signature
      FROM autoland_reports 
      WHERE id = $1`,
      [reportId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Report not found",
        },
        { status: 404 }
      )
    }

    const report = result.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        reportId: report.id,
        reportNumber: report.report_number,
        flightDetails: {
          airport: report.airport,
          runway: report.runway,
          captain: report.captain,
          first_officer: report.first_officer,
          wind_velocity: report.wind_velocity,
          qnh: report.qnh,
        },
        technicalParameters: {
          alignment: report.alignment,
          speed_control: report.speed_control,
          temperature: report.temperature,
          landing: report.landing,
          aircraft_dropout: report.aircraft_dropout,
          visibility_rvr: report.visibility_rvr,
        },
        other: {
          td_point: report.td_point,
          tracking: report.tracking,
          other: report.other,
        },
        rawData: report,
      },
    })
  } catch (error: any) {
    console.error("Debug report error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to debug report",
        message: error.message,
        details: error,
      },
      { status: 500 }
    )
  }
}

