/**
 * Cost Savings Analytics API
 * Returns metrics about PDF extraction cost savings
 */

import { NextResponse } from "next/server"
import { db } from "@/lib/db"

// Force dynamic rendering - this route uses database
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // Get overall statistics
    const statsResult = await db.query(`
      SELECT
        COUNT(*) as total_processed,
        COUNT(*) FILTER (WHERE extraction_method = 'pdf2json') as free_count,
        COUNT(*) FILTER (WHERE extraction_method = 'document-ai') as paid_count,
        COALESCE(SUM(extraction_cost), 0) as actual_cost,
        COALESCE(SUM(extraction_cost_saved), 0) as saved_cost,
        MIN(processed_at) as first_processed,
        MAX(processed_at) as last_processed
      FROM autoland_reports
      WHERE processed_at IS NOT NULL
    `)

    const stats = statsResult.rows[0]

    // Calculate cost without hybrid (all Document AI)
    const DOCUMENT_AI_COST_PER_PDF = 0.015
    const totalProcessed = parseInt(stats.total_processed)
    const costWithoutHybrid = totalProcessed * DOCUMENT_AI_COST_PER_PDF
    const actualCost = parseFloat(stats.actual_cost)
    const savedCost = parseFloat(stats.saved_cost)
    const savingsPercentage = costWithoutHybrid > 0
      ? ((costWithoutHybrid - actualCost) / costWithoutHybrid) * 100
      : 0

    // Get daily breakdown (last 30 days)
    const dailyBreakdownResult = await db.query(`
      SELECT
        DATE(processed_at) as date,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE extraction_method = 'pdf2json') as free_count,
        COUNT(*) FILTER (WHERE extraction_method = 'document-ai') as paid_count,
        COALESCE(SUM(extraction_cost), 0) as cost,
        COALESCE(SUM(extraction_cost_saved), 0) as saved
      FROM autoland_reports
      WHERE processed_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(processed_at)
      ORDER BY date DESC
      LIMIT 30
    `)

    // Get method breakdown
    const methodBreakdownResult = await db.query(`
      SELECT
        extraction_method,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage,
        COALESCE(SUM(extraction_cost), 0) as total_cost
      FROM autoland_reports
      WHERE extraction_method IS NOT NULL
      GROUP BY extraction_method
      ORDER BY count DESC
    `)

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalProcessed,
          freeSuccessCount: parseInt(stats.free_count),
          paidFallbackCount: parseInt(stats.paid_count),
          freeSuccessRate: totalProcessed > 0
            ? ((parseInt(stats.free_count) / totalProcessed) * 100).toFixed(1)
            : "0.0",
          costWithoutHybrid: `$${costWithoutHybrid.toFixed(4)}`,
          actualCost: `$${actualCost.toFixed(4)}`,
          savedCost: `$${savedCost.toFixed(4)}`,
          savingsPercentage: `${savingsPercentage.toFixed(1)}%`,
          firstProcessed: stats.first_processed,
          lastProcessed: stats.last_processed
        },
        dailyBreakdown: dailyBreakdownResult.rows.map(row => ({
          date: row.date,
          total: parseInt(row.total),
          freeCount: parseInt(row.free_count),
          paidCount: parseInt(row.paid_count),
          cost: parseFloat(row.cost),
          saved: parseFloat(row.saved)
        })),
        methodBreakdown: methodBreakdownResult.rows.map(row => ({
          method: row.extraction_method,
          count: parseInt(row.count),
          percentage: parseFloat(row.percentage),
          totalCost: parseFloat(row.total_cost)
        }))
      }
    })
  } catch (error) {
    console.error('Error fetching cost savings:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch cost savings data',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
