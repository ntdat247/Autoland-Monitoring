import { NextResponse } from "next/server"
import { db } from "@/lib/db"

// Force dynamic rendering - this route uses database
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Get dashboard statistics
    const [
      totalAircraftResult,
      overdueCountResult,
      dueSoonCountResult,
      successRateResult,
    ] = await Promise.all([
      // Total aircraft count
      db.query(`
        SELECT COUNT(*) as count
        FROM autoland_to_go
      `),
      
      // Overdue count
      db.query(`
        SELECT COUNT(*) as count
        FROM autoland_to_go
        WHERE status = 'OVERDUE'
      `),
      
      // Due soon count
      db.query(`
        SELECT COUNT(*) as count
        FROM autoland_to_go
        WHERE status = 'DUE_SOON'
      `),
      
      // Success rate calculation
      db.query(`
        WITH successful_autolands AS (
          SELECT COUNT(*) as count
          FROM autoland_reports
          WHERE result = 'SUCCESSFUL'
          AND date_utc >= CURRENT_DATE - INTERVAL '30 days'
        ),
        total_autolands AS (
          SELECT COUNT(*) as count
          FROM autoland_reports
          WHERE date_utc >= CURRENT_DATE - INTERVAL '30 days'
        )
        SELECT 
          CASE 
            WHEN total.count = 0 THEN 0
            ELSE ROUND((successful.count * 100.0) / total.count, 1)
          END as rate
        FROM successful_autolands successful, total_autolands total
      `),
    ])

    const stats = {
      totalAircraft: totalAircraftResult.rows[0].count,
      overdueCount: overdueCountResult.rows[0].count,
      dueSoonCount: dueSoonCountResult.rows[0].count,
      onTimeCount: totalAircraftResult.rows[0].count - overdueCountResult.rows[0].count - dueSoonCountResult.rows[0].count,
      successRate: successRateResult.rows[0].rate,
    }

    return NextResponse.json({
      success: true,
      data: stats,
    })
  } catch (error) {
    console.error("Error fetching dashboard stats:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch dashboard statistics",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    )
  }
}

