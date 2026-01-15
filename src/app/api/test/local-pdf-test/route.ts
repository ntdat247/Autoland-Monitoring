import { NextResponse } from "next/server"
import { parsePDFWithFallback } from "@/lib/parsers/hybrid-pdf-parser"
import { readFile } from "fs/promises"
import { join } from "path"

export const dynamic = 'force-dynamic'

/**
 * Local Test Endpoint for PDF Parsing
 * POST /api/test/local-pdf-test
 *
 * Test Bug #3 (timestamp) & Bug #4 (varchar) fixes locally
 *
 * Usage:
 * 1. Place test PDF in: public/test-pdf.pdf
 * 2. Run: curl -X POST http://localhost:3000/api/test/local-pdf-test
 */
export async function POST(request: Request) {
  try {
    console.log("=== Local PDF Test Started ===")

    // Read test PDF from public folder
    const pdfPath = join(process.cwd(), "public", "test-pdf.pdf")
    console.log("Reading PDF from:", pdfPath)

    const pdfData = await readFile(pdfPath)
    console.log("PDF size:", pdfData.length, "bytes")

    // Parse PDF using hybrid parser
    console.log("\n=== Step 1: Parsing PDF ===")
    const parseResult = await parsePDFWithFallback(pdfData)

    if (!parseResult.success || !parseResult.data) {
      return NextResponse.json({
        success: false,
        error: "Failed to parse PDF",
        details: parseResult
      }, { status: 400 })
    }

    const parsedData = parseResult.data

    console.log("\n=== Step 2: Validate Field Lengths ===")

    // Bug #4: Test field truncation
    const aircraftRegTruncated = parsedData.aircraft_reg?.substring(0, 20) || null
    const airportTruncated = parsedData.airport?.substring(0, 10) || null
    const runwayTruncated = parsedData.runway?.substring(0, 10) || null

    console.log("Original values:")
    console.log("  aircraft_reg:", parsedData.aircraft_reg, `(${parsedData.aircraft_reg?.length || 0} chars)`)
    console.log("  airport:", parsedData.airport, `(${parsedData.airport?.length || 0} chars)`)
    console.log("  runway:", parsedData.runway, `(${parsedData.runway?.length || 0} chars)`)

    console.log("\nTruncated values:")
    console.log("  aircraft_reg:", aircraftRegTruncated, `(${aircraftRegTruncated?.length || 0} chars)`)
    console.log("  airport:", airportTruncated, `(${airportTruncated?.length || 0} chars)`)
    console.log("  runway:", runwayTruncated, `(${runwayTruncated?.length || 0} chars)`)

    // Bug #3: Test timestamp conversion
    console.log("\n=== Step 3: Test Timestamp Conversion ===")

    let dateUtcStr = parsedData.date_utc
    let timeUtcStr = parsedData.time_utc

    console.log("Original values:")
    console.log("  date_utc type:", typeof dateUtcStr)
    console.log("  time_utc type:", typeof timeUtcStr)

    // Convert Date objects to strings if needed
    if (dateUtcStr instanceof Date) {
      dateUtcStr = dateUtcStr.toISOString().split('T')[0] // YYYY-MM-DD
      console.log("  date_utc converted:", dateUtcStr)
    }
    if (timeUtcStr instanceof Date) {
      timeUtcStr = timeUtcStr.toTimeString().split(' ')[0].substring(0, 5) // HH:MM
      console.log("  time_utc converted:", timeUtcStr)
    }

    // Create datetime_utc in ISO format for PostgreSQL timestamptz
    const datetimeUtc = `${dateUtcStr}T${timeUtcStr}:00+00`
    console.log("  datetime_utc:", datetimeUtc)

    console.log("\n=== Step 4: Parse Result ===")
    console.log("Extraction method:", parseResult.method)
    console.log("Cost: $" + parseResult.metrics.actualCost)
    console.log("Cost Saved: $" + parseResult.metrics.costSaved)
    console.log("Parsing attempts:", parseResult.parsingAttempts)

    if (parseResult.warnings?.length > 0) {
      console.log("\nWarnings:")
      parseResult.warnings.forEach(w => console.log("  -", w))
    }

    console.log("\n=== Local PDF Test Completed Successfully ===")

    return NextResponse.json({
      success: true,
      message: "PDF parsed successfully locally",
      data: {
        parsedData: {
          report_number: parsedData.report_number,
          aircraft_reg: aircraftRegTruncated,
          flight_number: parsedData.flight_number,
          airport: airportTruncated,
          runway: runwayTruncated,
          captain: parsedData.captain,
          first_officer: parsedData.first_officer,
          date_utc: dateUtcStr,
          time_utc: timeUtcStr,
          datetime_utc: datetimeUtc,
          result: parsedData.result,
        },
        extraction: {
          method: parseResult.method,
          cost: parseResult.metrics.actualCost,
          costSaved: parseResult.metrics.costSaved,
          parsingAttempts: parseResult.parsingAttempts,
        },
        warnings: parseResult.warnings,
        truncationApplied: {
          aircraft_reg: parsedData.aircraft_reg?.length > 20,
          airport: parsedData.airport?.length > 10,
          runway: parsedData.runway?.length > 10,
        }
      }
    })

  } catch (error: any) {
    console.error("\n=== Local PDF Test Failed ===")
    console.error("Error:", error.message)
    console.error("Stack:", error.stack)

    return NextResponse.json({
      success: false,
      error: "Local test failed",
      message: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}

// GET endpoint for testing
export async function GET() {
  return NextResponse.json({
    message: "Local PDF Test Endpoint",
    usage: "POST a PDF to this endpoint to test Bug #3 & #4 fixes",
    instructions: [
      "1. Place test PDF at: public/test-pdf.pdf",
      "2. Run: curl -X POST http://localhost:3000/api/test/local-pdf-test",
      "3. Check console output for detailed parsing logs"
    ]
  })
}
