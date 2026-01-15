import { NextResponse } from "next/server"
import { db } from "@/lib/db"

// Force dynamic rendering - this route uses database
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Fetch aircraft that need attention (overdue or due soon)
    const result = await db.query(`
      SELECT 
        atg.id,
        atg.aircraft_reg,
        atg.last_autoland_date,
        atg.next_required_date,
        atg.days_remaining,
        atg.status,
        atg.updated_at
      FROM autoland_to_go atg
      WHERE atg.status IN ('OVERDUE', 'DUE_SOON')
      ORDER BY 
        CASE 
          WHEN atg.status = 'OVERDUE' THEN 1
          ELSE 2
        END ASC,
        atg.days_remaining ASC
    `)

    return NextResponse.json({
      success: true,
      data: result.rows,
    })
  } catch (error) {
    console.error("Error fetching alerts:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch alerts",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    )
  }
}


