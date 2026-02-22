/**
 * PDF Parser using pdf2json (FREE)
 *
 * Strategy:
 * 1. Extract text with pdf2json
 * 2. Parse with regex parser
 * 3. If extraction/parsing fails -> Log error and return failure
 */

import { extractTextWithPdfParse, isExtractionViable } from "./pdf-text-extractor"
import { parseAutolandReport, ParseResult } from "./autoland-pdf-parser"

export interface HybridParseResult {
  success: boolean
  data: any | null
  method: 'pdf2json'
  parsingAttempts: {
    first: {
      method: 'pdf2json'
      extractionSuccess: boolean
      parsingSuccess: boolean
    }
  }
  metrics: {
    freeAttempt: boolean
    costSaved: number // USD (always $0.015 since we never use paid service)
    actualCost: number // USD (always $0)
  }
  errors: string[]
  warnings: string[]
}

/**
 * PDF parser using only pdf2json (free method)
 *
 * @param pdfBuffer - PDF file content as Buffer
 * @returns Promise<HybridParseResult> - Parsed data with metrics
 */
export async function parsePDFWithFallback(pdfBuffer: Buffer): Promise<HybridParseResult> {
  const errors: string[] = []
  const warnings: string[] = []

  // Cost constants (USD)
  const DOCUMENT_AI_COST_PER_PDF = 0.015 // Cost saved by using free method

  // Extract text using pdf2json (FREE)
  const freeExtraction = await extractTextWithPdfParse(pdfBuffer)

  let parsingResult: ParseResult | null = null

  if (freeExtraction.success && isExtractionViable(freeExtraction)) {
    parsingResult = parseAutolandReport(freeExtraction.text)

    if (parsingResult.success && parsingResult.data) {
      // SUCCESS with FREE method!
      return {
        success: true,
        data: parsingResult.data,
        method: 'pdf2json',
        parsingAttempts: {
          first: {
            method: 'pdf2json',
            extractionSuccess: true,
            parsingSuccess: true
          }
        },
        metrics: {
          freeAttempt: true,
          costSaved: DOCUMENT_AI_COST_PER_PDF,
          actualCost: 0
        },
        errors: [],
        warnings: parsingResult.warnings
      }
    }

    // Parsing failed with free extraction
    errors.push(...(parsingResult.errors || []))
    warnings.push(...(parsingResult.warnings || []))
    warnings.push('pdf2json extraction succeeded but parsing failed - PDF format may not be supported')
  } else {
    // Free extraction failed
    errors.push(freeExtraction.error || 'pdf2json extraction failed - PDF may be corrupted or in unsupported format')
  }

  // Return failure result
  return {
    success: false,
    data: null,
    method: 'pdf2json',
    parsingAttempts: {
      first: {
        method: 'pdf2json',
        extractionSuccess: freeExtraction.success,
        parsingSuccess: parsingResult?.success ?? false
      }
    },
    metrics: {
      freeAttempt: true,
      costSaved: DOCUMENT_AI_COST_PER_PDF,
      actualCost: 0
    },
    errors,
    warnings
  }
}

/**
 * Calculate cost savings from parsing
 */
export interface CostSavingsMetrics {
  totalPdfsProcessed: number
  freeSuccessCount: number
  freeFailCount: number
  freeSuccessRate: number // Percentage
  costWithoutHybrid: number // USD - if all used Document AI
  actualCost: number // USD - always $0 with free method
  savings: number // USD
  savingsPercentage: number
}

/**
 * Aggregate metrics from multiple parsing results
 */
export function calculateCostSavings(results: HybridParseResult[]): CostSavingsMetrics {
  const total = results.length
  const freeSuccess = results.filter(r => r.success).length
  const freeFail = results.filter(r => !r.success).length

  const DOCUMENT_AI_COST_PER_PDF = 0.015

  const costWithoutHybrid = total * DOCUMENT_AI_COST_PER_PDF
  const actualCost = 0 // Always free
  const savings = costWithoutHybrid

  return {
    totalPdfsProcessed: total,
    freeSuccessCount: freeSuccess,
    freeFailCount: freeFail,
    freeSuccessRate: total > 0 ? (freeSuccess / total) * 100 : 0,
    costWithoutHybrid,
    actualCost,
    savings,
    savingsPercentage: 100 // Always 100% savings since we never use paid service
  }
}
