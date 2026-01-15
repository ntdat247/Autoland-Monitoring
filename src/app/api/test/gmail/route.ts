import { NextResponse } from "next/server"
import { google } from "googleapis"

// Force dynamic rendering - this route uses request.url
export const dynamic = 'force-dynamic'

/**
 * Test endpoint để kiểm tra Gmail API integration
 * GET /api/test/gmail
 * 
 * Queries:
 * - ?action=list - List recent emails
 * - ?action=search&q=query - Search emails
 * - ?action=message&id=messageId - Get specific message
 * - ?action=auth - Get OAuth2 authorization URL
 * 
 * Headers:
 * - Authorization: Bearer {access_token} (nếu dùng OAuth2)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get("action") || "list"
    const query = searchParams.get("q") || ""
    const messageId = searchParams.get("id") || ""
    const code = searchParams.get("code") // OAuth2 callback code

    // Handle "auth" action first - doesn't need Gmail API initialization
    if (action === "config" || action === "debug") {
      // Show current OAuth2 configuration (for debugging)
      // Clean redirect URI: remove quotes and trim whitespace
      const rawRedirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/test/gmail/callback"
      const redirectUri = rawRedirectUri.replace(/^["']|["']$/g, '').trim()
      
      return NextResponse.json({
        success: true,
        data: {
          config: {
            hasClientId: !!process.env.GOOGLE_CLIENT_ID,
            hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
            clientIdPrefix: process.env.GOOGLE_CLIENT_ID 
              ? process.env.GOOGLE_CLIENT_ID.substring(0, 20) + "..." 
              : "NOT SET",
            redirectUri: redirectUri,
            redirectUriFromEnv: process.env.GOOGLE_REDIRECT_URI || "NOT SET (using default)",
          },
          instructions: [
            "✅ Kiểm tra redirectUri phải khớp chính xác với Google Cloud Console",
            "✅ Trong Google Cloud Console > Credentials > OAuth Client ID",
            "✅ Authorized redirect URIs phải có: " + redirectUri,
            "✅ Không có khoảng trắng, không có dấu / ở cuối",
          ],
        },
      })
    }

    if (action === "auth") {
      // Check if OAuth2 credentials are configured
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return NextResponse.json(
          {
            success: false,
            error: "OAuth2 credentials not configured",
            message: "Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env file",
            instructions: [
              "1. Create OAuth2 Client ID in Google Cloud Console",
              "2. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env file",
              "3. See SETUP_GMAIL_PERSONAL.md for detailed instructions",
            ],
          },
          { status: 400 }
        )
      }

      // Clean redirect URI: remove quotes and trim whitespace
      const rawRedirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/test/gmail/callback"
      const redirectUri = rawRedirectUri.replace(/^["']|["']$/g, '').trim()

      // Generate OAuth2 authorization URL
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        redirectUri
      )

      const scopes = [
        "https://www.googleapis.com/auth/gmail.readonly",
      ]

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: scopes,
        prompt: "consent", // Force consent screen to get refresh token
      })

      return NextResponse.json({
        success: true,
        data: {
          authUrl,
          redirectUri: redirectUri, // Include redirect URI in response for debugging
          message: "Visit this URL to authorize the application",
          instructions: [
            "1. Visit the authUrl above",
            "2. Sign in with tiendat2407@gmail.com",
            "3. Grant permissions",
            "4. Copy the 'code' from the redirect URL",
            "5. Use /api/test/gmail/token?code=xxx to get access token",
            "",
            "⚠️ Nếu gặp lỗi 'redirect_uri_mismatch':",
            "   - Kiểm tra redirectUri trong response này",
            "   - Đảm bảo nó khớp chính xác với Google Cloud Console",
            "   - Gọi /api/test/gmail?action=config để xem cấu hình",
          ],
        },
      })
    }

    // Get authorization header for OAuth2 token
    const authHeader = request.headers.get("authorization")
    const accessToken = authHeader?.replace("Bearer ", "")

    // Initialize Gmail API for other actions
    let auth: any
    let gmail: any

    // Check if using OAuth2 (access token provided) or Service Account
    if (accessToken) {
      // OAuth2 flow - use access token
      auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/test/gmail/callback"
      )
      auth.setCredentials({ access_token: accessToken })
      gmail = google.gmail({ version: "v1", auth })
    } else if (process.env.GCP_KEY_FILE && process.env.GCP_PROJECT_ID) {
      // Service Account flow with impersonation (for Google Workspace)
      auth = new google.auth.GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
        keyFile: process.env.GCP_KEY_FILE,
        projectId: process.env.GCP_PROJECT_ID,
      })
      
      // If GMAIL_USER is set, use impersonation (domain-wide delegation)
      if (process.env.GMAIL_USER) {
        const authClient = await auth.getClient() as any
        authClient.subject = process.env.GMAIL_USER // Impersonate this user
        gmail = google.gmail({ version: "v1", auth: authClient })
      } else {
        gmail = google.gmail({ version: "v1", auth })
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

    switch (action) {

      case "list": {
        // List recent emails
        const response = await gmail.users.messages.list({
          userId: "me",
          maxResults: 10,
          q: query || "has:attachment",
        })

        const messages = response.data.messages || []
        const messageDetails = await Promise.all(
          messages.slice(0, 5).map(async (msg: any) => {
            const message = await gmail.users.messages.get({
              userId: "me",
              id: msg.id!,
              format: "metadata",
              metadataHeaders: ["Subject", "From", "Date"],
            })

            return {
              id: msg.id,
              threadId: msg.threadId,
              subject: message.data.payload?.headers?.find(
                (h: any) => h.name === "Subject"
              )?.value,
              from: message.data.payload?.headers?.find(
                (h: any) => h.name === "From"
              )?.value,
              date: message.data.payload?.headers?.find(
                (h: any) => h.name === "Date"
              )?.value,
            }
          })
        )

        return NextResponse.json({
          success: true,
          data: {
            total: messages.length,
            messages: messageDetails,
          },
        })
      }

      case "search": {
        // Search emails with query
        const response = await gmail.users.messages.list({
          userId: "me",
          q: query,
          maxResults: 20,
        })

        return NextResponse.json({
          success: true,
          data: {
            query,
            results: response.data.messages || [],
            resultSizeEstimate: response.data.resultSizeEstimate,
          },
        })
      }

      case "message": {
        if (!messageId) {
          return NextResponse.json(
            { success: false, error: "Message ID is required" },
            { status: 400 }
          )
        }

        // Get specific message with full details
        const message = await gmail.users.messages.get({
          userId: "me",
          id: messageId,
        })

        const payload = message.data.payload
        const headers = payload?.headers || []
        const parts = payload?.parts || []

        // Extract headers
        const emailData = {
          id: message.data.id,
          threadId: message.data.threadId,
          subject: headers.find((h: any) => h.name === "Subject")?.value,
          from: headers.find((h: any) => h.name === "From")?.value,
          to: headers.find((h: any) => h.name === "To")?.value,
          date: headers.find((h: any) => h.name === "Date")?.value,
          snippet: message.data.snippet,
          attachments: [] as any[],
        }

        // Find PDF attachments
        for (const part of parts) {
          if (part.filename && part.filename.toLowerCase().endsWith(".pdf")) {
            emailData.attachments.push({
              filename: part.filename,
              mimeType: part.mimeType,
              size: part.body?.size,
              attachmentId: part.body?.attachmentId,
            })
          }
        }

        return NextResponse.json({
          success: true,
          data: emailData,
        })
      }

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error("Gmail API Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to access Gmail API",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
        details: error,
      },
      { status: 500 }
    )
  }
}
