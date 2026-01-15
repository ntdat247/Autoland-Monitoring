import { NextResponse } from "next/server"
import { google } from "googleapis"

// Force dynamic rendering - this route uses request.url
export const dynamic = 'force-dynamic'

/**
 * OAuth2 Refresh Token Endpoint
 * GET /api/test/gmail/refresh?refresh_token=xxx
 * 
 * Refreshes an expired access token using refresh token
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const refreshToken = searchParams.get("refresh_token")

    if (!refreshToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Refresh token is required",
          message: "Add ?refresh_token=xxx to the URL",
          instructions: [
            "1. Get refresh_token from initial OAuth2 authorization",
            "2. Call this endpoint with refresh_token parameter",
            "3. Use the new access_token from response",
          ],
        },
        { status: 400 }
      )
    }

    // Validate OAuth2 credentials
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return NextResponse.json({
        success: false,
        error: "OAuth2 credentials not configured",
        message: "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env file",
      }, { status: 400 })
    }

    // Clean redirect URI: remove quotes and trim whitespace
    const rawRedirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/test/gmail/callback"
    const redirectUri = rawRedirectUri.replace(/^["']|["']$/g, '').trim()
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    )

    // Set refresh token
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    })

    // Refresh access token
    const { credentials } = await oauth2Client.refreshAccessToken()

    return NextResponse.json({
      success: true,
      data: {
        access_token: credentials.access_token,
        expiry_date: credentials.expiry_date,
        token_type: credentials.token_type,
        scope: credentials.scope,
        instructions: [
          "✅ Access token refreshed successfully!",
          "Use the new access_token in Authorization header",
          "Access token expires after 1 hour, refresh again when needed",
        ],
      },
    })
  } catch (error: any) {
    console.error("Token Refresh Error:", error)
    
    let errorMessage = "Unknown error occurred"
    let errorDetails: any = {}
    
    if (error instanceof Error) {
      errorMessage = error.message
    }
    
    if (error?.response?.data) {
      errorDetails = error.response.data
      errorMessage = error.response.data.error_description || error.response.data.error || errorMessage
    }
    
    return NextResponse.json(
      {
        success: false,
        error: "Failed to refresh access token",
        message: errorMessage,
        details: errorDetails,
        troubleshooting: [
          "Check if refresh_token is valid and not expired",
          "Ensure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are correct",
          "You may need to re-authorize if refresh_token is invalid",
        ],
      },
      { status: 500 }
    )
  }
}

