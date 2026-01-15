import { NextResponse } from "next/server"
import { google } from "googleapis"

// Force dynamic rendering - this route uses request.url
export const dynamic = 'force-dynamic'

/**
 * OAuth2 Callback Endpoint
 * GET /api/test/gmail/callback?code=xxx
 * 
 * Exchanges authorization code for tokens and returns them
 */
export async function GET(request: Request) {
  // Clean redirect URI: remove quotes and trim whitespace
  const rawRedirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/test/gmail/callback"
  const redirectUri = rawRedirectUri.replace(/^["']|["']$/g, '').trim()
  
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get("code")

    if (!code) {
      return NextResponse.json({
        success: false,
        error: "No authorization code received",
        message: "Add ?code=xxx to the URL",
      })
    }

    // Validate OAuth2 credentials
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return NextResponse.json({
        success: false,
        error: "OAuth2 credentials not configured",
        message: "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env file",
        instructions: [
          "1. Check your .env file exists in the project root",
          "2. Verify GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set",
          "3. Restart the development server after updating .env",
          "4. See SETUP_GMAIL_PERSONAL.md for detailed instructions",
        ],
      }, { status: 400 })
    }
    
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
          "✅ Authorization successful!",
          "Save these tokens securely",
          "Use access_token in Authorization header: Bearer {access_token}",
          "When access_token expires, use refresh_token to get new access_token",
        ],
      },
    })
  } catch (error: any) {
    console.error("Token Exchange Error:", error)
    
    // Extract detailed error information
    let errorMessage = "Unknown error occurred"
    let errorDetails: any = {}
    
    if (error instanceof Error) {
      errorMessage = error.message
    }
    
    // Check for specific OAuth2 errors
    if (error?.response?.data) {
      errorDetails = error.response.data
      errorMessage = error.response.data.error_description || error.response.data.error || errorMessage
    }
    
    // Common error messages and solutions
    const troubleshooting: Record<string, string[]> = {
      "invalid_client": [
        "Client ID hoặc Client Secret không đúng",
        "Kiểm tra lại GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET trong .env",
        "Đảm bảo đã copy đúng từ Google Cloud Console (không có khoảng trắng thừa)",
        "Restart development server sau khi sửa .env",
      ],
      "redirect_uri_mismatch": [
        "Redirect URI không khớp với cấu hình trong Google Cloud Console",
        `Redirect URI hiện tại: ${process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/test/gmail/callback"}`,
        "Kiểm tra Authorized redirect URIs trong Google Cloud Console",
        "Đảm bảo redirect URI chính xác (bao gồm http/https, port, path)",
      ],
      "invalid_grant": [
        "Authorization code đã hết hạn hoặc đã được sử dụng",
        "Thử lại từ đầu: gọi /api/test/gmail?action=auth để lấy code mới",
      ],
    }
    
    const errorKey = errorDetails.error || errorMessage.toLowerCase()
    const solutions = troubleshooting[errorKey] || [
      "Kiểm tra lại cấu hình OAuth2 credentials",
      "Xem SETUP_GMAIL_PERSONAL.md để hướng dẫn chi tiết",
    ]
    
    return NextResponse.json(
      {
        success: false,
        error: "Failed to exchange authorization code",
        message: errorMessage,
        details: errorDetails,
        troubleshooting: solutions,
        config: {
          hasClientId: !!process.env.GOOGLE_CLIENT_ID,
          hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
          redirectUri: redirectUri,
        },
      },
      { status: 500 }
    )
  }
}

