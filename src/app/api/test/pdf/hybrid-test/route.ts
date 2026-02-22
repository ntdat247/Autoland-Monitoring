/**
 * Test endpoint for PDF Parser
 * Tests pdf2json parsing capability
 */

import { NextRequest, NextResponse } from 'next/server'
import { parsePDFWithFallback, calculateCostSavings } from '@/lib/parsers/hybrid-pdf-parser'
import path from 'path'

// Force dynamic rendering - this route uses filesystem
export const dynamic = 'force-dynamic'

// Sample PDF files for testing
const SAMPLE_PDFS = [
  'VJC_VN-A546_VJ442_X_PQC_20251230013957_AUTOLAND_REPORT_20251230042559.pdf',
  'VJC_VN-A669_VJ440_X_PQC_20251230040152_AUTOLAND_REPORT_20251230064158.pdf',
  'VJC_VN-A810_VJ327_X_SGN_20251230050523_AUTOLAND_REPORT_20251230065258.pdf'
]

export async function GET(request: NextRequest) {
  const results: any[] = []
  const projectRoot = path.resolve(process.cwd())

  for (const pdfFile of SAMPLE_PDFS) {
    const pdfPath = path.join(projectRoot, pdfFile)

    try {
      const fs = await import('fs/promises')
      const pdfBuffer = await fs.readFile(pdfPath)

      // Test pdf2json parser
      const parseResult = await parsePDFWithFallback(pdfBuffer)

      results.push({
        file: pdfFile,
        success: parseResult.success,
        method: parseResult.method,
        parsingAttempts: parseResult.parsingAttempts,
        metrics: parseResult.metrics,
        data: parseResult.data ? {
          report_number: parseResult.data.report_number,
          aircraft_reg: parseResult.data.aircraft_reg,
          flight_number: parseResult.data.flight_number,
          airport: parseResult.data.airport,
          runway: parseResult.data.runway,
          result: parseResult.data.result
        } : null,
        errors: parseResult.errors,
        warnings: parseResult.warnings
      })
    } catch (error) {
      results.push({
        file: pdfFile,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  // Calculate cost savings
  const successfulResults = results.filter((r: any) => r.success)
  const costSavings = calculateCostSavings(successfulResults)

  // Statistics
  const stats = {
    total: results.length,
    extractionSuccess: successfulResults.length,
    parsingSuccess: successfulResults.filter((r: any) => r.success).length,
    freeSuccess: successfulResults.filter((r: any) => r.method === 'pdf2json').length,
    freeSuccessRate: `${costSavings.freeSuccessRate.toFixed(1)}%`,
    overallSuccessRate: `${((successfulResults.length / results.length) * 100).toFixed(1)}%`
  }

  return NextResponse.json({
    test: 'PDF Parser Test (pdf2json only)',
    timestamp: new Date().toISOString(),
    statistics: stats,
    costSavings: {
      totalProcessed: costSavings.totalPdfsProcessed,
      freeSuccess: costSavings.freeSuccessCount,
      freeFail: costSavings.freeFailCount,
      costWithoutHybrid: `$${costSavings.costWithoutHybrid.toFixed(4)}`,
      actualCost: `$${costSavings.actualCost.toFixed(4)}`,
      savings: `$${costSavings.savings.toFixed(4)}`,
      savingsPercentage: `${costSavings.savingsPercentage.toFixed(1)}%`
    },
    results: results
  })
}
