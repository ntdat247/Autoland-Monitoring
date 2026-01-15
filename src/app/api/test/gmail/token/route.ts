import { NextResponse } from "next/server"
import { google } from "googleapis"

// Force dynamic rendering - this route uses request.url
export const dynamic = 'force-dynamic'

/**
 * OAuth2 Token Exchange Endpoint
 * GET /api/test/gmail/token?code=xxx
 * 
 * Exchanges authorization code for access token and refresh token
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get("code")

    if (!code) {
      return NextResponse.json(
        {
          success: false,
          error: "Authorization code is required",
          message: "Add ?code=xxx to the URL",
        },
        { status: 400 }
      )
    }

    // Clean redirect URI: remove quotes and trim whitespace
    const rawRedirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/test/gmail/callback"
    const redirectUri = rawRedirectUri.replace(/^["']|["']$/g, '').trim()
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    )

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code)

    return NextResponse.json({
      success: true,
      data: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date,
        token_type: tokens.token_type,
        scope: tokens.scope,
        instructions: [
          "Save these tokens securely",
          "Use access_token in Authorization header: Bearer {access_token}",
          "When access_token expires, use refresh_token to get new access_token",
        ],
      },
    })
  } catch (error) {
    console.error("Token Exchange Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to exchange authorization code",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    )
  }
}

