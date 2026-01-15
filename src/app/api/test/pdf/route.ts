import { NextResponse } from "next/server"
import { google } from "googleapis"
import { Storage } from "@google-cloud/storage"
import { DocumentProcessorServiceClient } from "@google-cloud/documentai"

// Force dynamic rendering - this route uses request.url
export const dynamic = 'force-dynamic'

/**
 * Test endpoint để kiểm tra PDF download và extraction
 * GET /api/test/pdf?messageId=xxx&attachmentId=xxx
 * 
 * Steps:
 * 1. Download PDF từ Gmail attachment
 * 2. Upload PDF lên Cloud Storage
 * 3. Extract text từ PDF bằng Document AI
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get("messageId")
    const attachmentId = searchParams.get("attachmentId")

    if (!messageId || !attachmentId) {
      return NextResponse.json(
        {
          success: false,
          error: "messageId and attachmentId are required",
        },
        { status: 400 }
      )
    }

    // Step 1: Initialize Gmail API
    // Get authorization header for OAuth2 token
    const authHeader = request.headers.get("authorization")
    const accessToken = authHeader?.replace("Bearer ", "")

    let gmail: any

    if (accessToken) {
      // OAuth2 flow - use access token
      const auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/test/gmail/callback"
      )
      auth.setCredentials({ access_token: accessToken })
      gmail = google.gmail({ version: "v1", auth })
    } else if (process.env.GCP_KEY_FILE && process.env.GCP_PROJECT_ID) {
      // Service Account flow with impersonation (for Google Workspace)
      const gmailAuth = new google.auth.GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
        keyFile: process.env.GCP_KEY_FILE,
        projectId: process.env.GCP_PROJECT_ID,
      })
      
      // If GMAIL_USER is set, use impersonation (domain-wide delegation)
      if (process.env.GMAIL_USER) {
        const authClient = await gmailAuth.getClient() as any
        authClient.subject = process.env.GMAIL_USER // Impersonate this user
        gmail = google.gmail({ version: "v1", auth: authClient })
      } else {
        gmail = google.gmail({ version: "v1", auth: gmailAuth })
      }
    } else {
      return NextResponse.json(
        {
          success: false,
          error: "No authentication method configured",
          message: "Please provide OAuth2 access token in Authorization header, or configure GCP_KEY_FILE and GCP_PROJECT_ID",
        },
        { status: 401 }
      )
    }

    // Step 2: Download PDF attachment
    console.log(`Downloading attachment ${attachmentId} from message ${messageId}`)
    const attachment = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId: messageId,
      id: attachmentId,
    })

    const pdfData = Buffer.from(
      attachment.data.data!,
      "base64"
    )

    console.log(`PDF downloaded: ${pdfData.length} bytes`)

    // Step 3: Upload to Cloud Storage (optional, for testing)
    const storage = new Storage({
      projectId: process.env.GCP_PROJECT_ID,
      keyFilename: process.env.GCP_KEY_FILE,
    })

    const bucketName = process.env.GCP_STORAGE_BUCKET || "autoland-reports-test"
    const fileName = `test/${Date.now()}-attachment.pdf`

    const bucket = storage.bucket(bucketName)
    const file = bucket.file(fileName)

    await file.save(pdfData, {
      metadata: {
        contentType: "application/pdf",
      },
    })

    console.log(`PDF uploaded to: gs://${bucketName}/${fileName}`)

    // Step 4: Extract text using Document AI
    const documentAI = new DocumentProcessorServiceClient({
      keyFilename: process.env.GCP_KEY_FILE,
    })

    const processorName =
      process.env.DOCUMENT_AI_PROCESSOR_ID ||
      "projects/YOUR_PROJECT/locations/YOUR_LOCATION/processors/YOUR_PROCESSOR"

    console.log(`Processing PDF with Document AI: ${processorName}`)

    const [result] = await documentAI.processDocument({
      name: processorName,
      rawDocument: {
        content: pdfData,
        mimeType: "application/pdf",
      },
    })

    const document = result.document
    const extractedText = document?.text || ""

    // Extract structured data (if available)
    const entities = document?.entities || []

    return NextResponse.json({
      success: true,
      data: {
        messageId,
        attachmentId,
        pdfSize: pdfData.length,
        storagePath: `gs://${bucketName}/${fileName}`,
        extraction: {
          text: extractedText.substring(0, 1000), // First 1000 chars
          fullTextLength: extractedText.length,
          entities: entities.map((e) => ({
            type: e.type,
            value: e.mentionText,
            confidence: e.confidence,
          })),
        },
      },
    })
  } catch (error) {
    console.error("PDF Processing Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process PDF",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
        details: error,
      },
      { status: 500 }
    )
  }
}

