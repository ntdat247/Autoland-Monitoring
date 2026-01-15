import { NextResponse } from "next/server"
import { db } from "@/lib/db"

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
    // Get report details
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
        ar.email_id,
        ar.email_subject,
        ar.email_sender,
        ar.email_received_time,
        ar.pdf_filename,
        ar.pdf_storage_path,
        ar.pdf_storage_bucket,
        ar.processed_at,
        ar.extraction_status,
        ar.extraction_errors,
        ar.raw_extracted_text,
        ar.created_at,
        ar.updated_at
      FROM autoland_reports ar
      WHERE ar.id = $1
    `, [reportId])
    
    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Report not found",
      }, { status: 404 })
    }
    
    return NextResponse.json({
      success: true,
      data: {
        report: result.rows[0],
      },
    })
  } catch (error) {
    console.error("Error fetching report detail:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch report detail",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
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
    // Get report details before deletion (to get aircraft_reg for updating autoland_to_go)
    const reportResult = await db.query(
      `SELECT aircraft_reg FROM autoland_reports WHERE id = $1`,
      [reportId]
    )
    
    if (reportResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Report not found",
      }, { status: 404 })
    }
    
    const aircraftReg = reportResult.rows[0].aircraft_reg
    
    // Delete the report
    await db.query(
      `DELETE FROM autoland_reports WHERE id = $1`,
      [reportId]
    )
    
    console.log(`Report ${reportId} deleted successfully`)
    
    // Update autoland_to_go for the aircraft (recalculate after deletion)
    // First, check if there are any successful autolands left for this aircraft
    const remainingAutolands = await db.query(
      `SELECT COUNT(*) as count FROM autoland_reports 
       WHERE aircraft_reg = $1 AND result = 'SUCCESSFUL'`,
      [aircraftReg]
    )
    
    if (remainingAutolands.rows[0].count === '0') {
      // No successful autolands left, delete from autoland_to_go
      await db.query(
        `DELETE FROM autoland_to_go WHERE aircraft_reg = $1`,
        [aircraftReg]
      )
      console.log(`Removed aircraft ${aircraftReg} from autoland_to_go (no successful autolands left)`)
    } else {
      // Recalculate autoland_to_go
      await db.query(
        `INSERT INTO autoland_to_go (
          aircraft_reg, last_autoland_date, last_autoland_report_id,
          next_required_date, days_remaining, status
        )
        SELECT
          $1,
          last_autoland_date,
          last_autoland_report_id,
          next_required_date,
          days_remaining,
          status
        FROM calculate_autoland_to_go($1)
        WHERE last_autoland_date IS NOT NULL
        ON CONFLICT (aircraft_reg) DO UPDATE SET
          last_autoland_date = EXCLUDED.last_autoland_date,
          last_autoland_report_id = EXCLUDED.last_autoland_report_id,
          next_required_date = EXCLUDED.next_required_date,
          days_remaining = EXCLUDED.days_remaining,
          status = EXCLUDED.status,
          updated_at = CURRENT_TIMESTAMP
        WHERE autoland_to_go.aircraft_reg = $1`,
        [aircraftReg]
      )
      console.log(`Updated autoland_to_go for aircraft: ${aircraftReg}`)
    }
    
    console.log(`Updated autoland_to_go for aircraft: ${aircraftReg}`)
    
    return NextResponse.json({
      success: true,
      message: `Report ${reportId} deleted successfully`,
      data: {
        deletedId: reportId,
        aircraftReg: aircraftReg,
      },
    })
  } catch (error) {
    console.error("Error deleting report:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete report",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    )
  }
}

