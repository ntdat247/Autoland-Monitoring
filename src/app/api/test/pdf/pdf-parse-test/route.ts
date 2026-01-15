/**
 * Test endpoint for pdf-parse library
 * Tests text extraction from sample PDF files
 */

import { NextRequest, NextResponse } from 'next/server'
import { extractTextFromPdfFile, isExtractionViable } from '@/lib/parsers/pdf-text-extractor'
import { parseAutolandReport } from '@/lib/parsers/autoland-pdf-parser'
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
      // Extract text using pdf-parse
      const extractionResult = await extractTextFromPdfFile(pdfPath)

      // Parse extracted text
      let parseResult = null
      if (isExtractionViable(extractionResult)) {
        parseResult = parseAutolandReport(extractionResult.text)
      }

      results.push({
        file: pdfFile,
        extraction: {
          success: extractionResult.success,
          textLength: extractionResult.text.length,
          preview: extractionResult.text.substring(0, 200) + '...',
          pages: extractionResult.metadata?.pages,
          error: extractionResult.error
        },
        parsing: parseResult ? {
          success: parseResult.success,
          data: parseResult.data,
          errors: parseResult.errors,
          warnings: parseResult.warnings
        } : null,
        overallSuccess: extractionResult.success && parseResult?.success
      })
    } catch (error) {
      results.push({
        file: pdfFile,
        extraction: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        parsing: null,
        overallSuccess: false
      })
    }
  }

  // Calculate statistics
  const stats = {
    total: results.length,
    extractionSuccess: results.filter(r => r.extraction.success).length,
    parsingSuccess: results.filter(r => r.parsing?.success).length,
    overallSuccess: results.filter(r => r.overallSuccess).length,
    extractionSuccessRate: `${((results.filter(r => r.extraction.success).length / results.length) * 100).toFixed(1)}%`,
    overallSuccessRate: `${((results.filter(r => r.overallSuccess).length / results.length) * 100).toFixed(1)}%`
  }

  return NextResponse.json({
    test: 'pdf-parse extraction test',
    timestamp: new Date().toISOString(),
    statistics: stats,
    results: results
  })
}
