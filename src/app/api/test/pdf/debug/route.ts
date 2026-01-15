import { NextResponse } from "next/server"
import { google } from "googleapis"
import { DocumentProcessorServiceClient } from "@google-cloud/documentai"
import { Storage } from "@google-cloud/storage"
import { parseAutolandReport } from "@/lib/parsers/autoland-pdf-parser"

// Force dynamic rendering - this route uses request.url
export const dynamic = 'force-dynamic'

/**
 * Debug endpoint to see extracted text and parsed data
 * GET /api/test/pdf/debug?messageId=xxx&attachmentId=xxx
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get("messageId")
    const attachmentId = searchParams.get("attachmentId")
    const authHeader = request.headers.get("authorization")

    if (!messageId || !attachmentId) {
      return NextResponse.json(
        {
          success: false,
          error: "messageId and attachmentId are required",
        },
        { status: 400 }
      )
    }

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          success: false,
          error: "Authorization header with Bearer token is required",
        },
        { status: 401 }
      )
    }

    const accessToken = authHeader.replace("Bearer ", "")

    // Initialize Gmail API
    const oauth2Client = new google.auth.OAuth2()
    oauth2Client.setCredentials({ access_token: accessToken })
    const gmail = google.gmail({ version: "v1", auth: oauth2Client })

    // Download PDF attachment
    const attachmentResponse = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId: messageId,
      id: attachmentId,
    })

    const pdfData = Buffer.from(
      attachmentResponse.data.data!,
      "base64"
    )

    // Extract text using Document AI
    const documentAI = new DocumentProcessorServiceClient({
      keyFilename: process.env.GCP_KEY_FILE,
    })

    const processorName = process.env.DOCUMENT_AI_PROCESSOR_ID
    if (!processorName) {
      return NextResponse.json(
        {
          success: false,
          error: "DOCUMENT_AI_PROCESSOR_ID not configured",
        },
        { status: 500 }
      )
    }

    const [result] = await documentAI.processDocument({
      name: processorName,
      rawDocument: {
        content: pdfData,
        mimeType: "application/pdf",
      },
    })

    const document = result.document
    const extractedText = document?.text || ""

    // Parse extracted text
    const parseResult = parseAutolandReport(extractedText)

    // Return debug information
    return NextResponse.json({
      success: true,
      data: {
        extractedText: extractedText,
        extractedTextLength: extractedText.length,
        parseResult: parseResult,
        // Show matches for debugging
        debugMatches: {
          windVelocity: extractedText.match(/W\/V[:\s]*\n\s*([0-9]{3}\/[0-9]{1,2})/i) || 
                       extractedText.match(/W\/V[:\s]+([0-9]{3}\/[0-9]{1,2})/i) ||
                       extractedText.match(/W\/V[:\s]*([0-9]{3}\/[0-9]{1,2})/i),
          qnh: extractedText.match(/QNH[:\s]*\n\s*(\d{3,4})(?:\n|ALIGNMENT|TEMP|$)/i) ||
               extractedText.match(/QNH[:\s]+(\d{3,4})(?:\n|ALIGNMENT|TEMP|$)/i) ||
               extractedText.match(/QNH[:\s]*(\d{3,4})(?:\n|ALIGNMENT|TEMP|$)/i),
          alignment: extractedText.match(/ALIGNMENT[:\s]*\n\s*([^\n]+?)(?:\n|TEMP|SPEED|QNH|$)/i) ||
                     extractedText.match(/ALIGNMENT[:\s]+([^\n]+?)(?:\n|TEMP|SPEED|QNH|$)/i) ||
                     extractedText.match(/ALIGNMENT[:\s]*([^\n]+?)(?:\n|TEMP|SPEED|QNH|$)/i),
          speedControl: extractedText.match(/SPEED\s*CONTROL[:\s]*\n\s*([^\n]+?)(?:\n|A\/C|VIS|TRACKING|$)/i) ||
                       extractedText.match(/SPEED\s*CONTROL[:\s]+([^\n]+?)(?:\n|A\/C|VIS|TRACKING|$)/i) ||
                       extractedText.match(/SPEED\s*CONTROL[:\s]*([^\n]+?)(?:\n|A\/C|VIS|TRACKING|$)/i),
          temp: extractedText.match(/TEMP[:\s]*\n\s*(\d{1,2})(?:\n|LANDING|$)/i) ||
                extractedText.match(/TEMP[:\s]+(\d{1,2})(?:\n|LANDING|$)/i) ||
                extractedText.match(/TEMP[:\s]*(\d{1,2})(?:\n|LANDING|$)/i),
          landing: extractedText.match(/LANDING[:\s]*\n\s*([^\n]+?)(?:\n|A\/C|VIS|TEMP|$)/i) ||
                   extractedText.match(/LANDING[:\s]+([^\n]+?)(?:\n|A\/C|VIS|TEMP|$)/i) ||
                   extractedText.match(/LANDING[:\s]*([^\n]+?)(?:\n|A\/C|VIS|TEMP|$)/i),
          aircraftDropout: extractedText.match(/A\/C\s*DROPOUT[:\s]*\n\s*([^\n]+?)(?:\n|VIS|OTHER|$)/i) ||
                           extractedText.match(/A\/C\s*DROPOUT[:\s]+([^\n]+?)(?:\n|VIS|OTHER|$)/i) ||
                           extractedText.match(/A\/C\s*DROPOUT[:\s]*([^\n]+?)(?:\n|VIS|OTHER|$)/i),
          visibilityRvr: extractedText.match(/VIS\/RVR[:\s]*\n\s*([^\n]+?)(?:\n|TRACKING|OTHER|RESULT|$)/i) ||
                         extractedText.match(/VIS\/RVR[:\s]+([^\n]+?)(?:\n|TRACKING|OTHER|RESULT|$)/i) ||
                         extractedText.match(/VIS\/RVR[:\s]*([^\n]+?)(?:\n|TRACKING|OTHER|RESULT|$)/i),
        },
      },
    })
  } catch (error: any) {
    console.error("Debug PDF Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to debug PDF",
        message: error.message,
        details: error,
      },
      { status: 500 }
    )
  }
}

