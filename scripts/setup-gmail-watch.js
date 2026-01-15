/**
 * Setup Gmail Watch to send notifications to Pub/Sub topic
 * 
 * Usage:
 *   node scripts/setup-gmail-watch.js
 * 
 * Environment Variables:
 *   - GCP_PROJECT_ID: Google Cloud Project ID
 *   - GOOGLE_CLIENT_ID: OAuth2 Client ID
 *   - GOOGLE_CLIENT_SECRET: OAuth2 Client Secret
 *   - GOOGLE_REDIRECT_URI: OAuth2 Redirect URI (default: http://localhost:3000/oauth2callback)
 *     ⚠️ QUAN TRỌNG: Redirect URI này PHẢI được thêm vào Google Cloud Console > OAuth Client > Authorized redirect URIs
 *   - PUBSUB_TOPIC: Pub/Sub topic name (default: gmail-notifications)
 */

const { google } = require('googleapis');
const http = require('http');
const readline = require('readline');

async function getAccessToken() {
  return new Promise(async (resolve, reject) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback';
    const useManualFlow = process.env.MANUAL_FLOW === 'true' || process.env.CLOUDSHELL === 'true';
    
    if (!clientId || !clientSecret) {
      throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables are required');
    }
    
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );
    
    // Generate auth URL
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/pubsub',
    ];
    
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // Force consent to get refresh token
    });
    
    console.log('\n🔐 Authorization required!');
    console.log('Please visit this URL to authorize the application:');
    console.log('\n' + authUrl + '\n');
    
    if (useManualFlow) {
      // Manual flow: Ask user to paste the authorization code
      console.log('📋 Manual Flow Mode (for Cloud Shell or remote servers)');
      console.log('After authorizing, you will be redirected to a URL that looks like:');
      console.log('  ' + redirectUri + '?code=4/0A...');
      console.log('\nPlease copy the ENTIRE URL from your browser address bar and paste it below:');
      console.log('(Or just paste the authorization code if you extracted it)\n');
      
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      rl.question('Paste the full redirect URL or authorization code: ', async (input) => {
        rl.close();
        
        try {
          let code = input.trim();
          
          // If user pasted full URL, extract code
          if (code.includes('?code=')) {
            const url = new URL(code);
            code = url.searchParams.get('code');
          } else if (code.includes('code=')) {
            // Handle case where URL might not have protocol
            const match = code.match(/code=([^&]+)/);
            if (match) {
              code = match[1];
            }
          }
          
          if (!code) {
            reject(new Error('Could not extract authorization code from input. Please paste the full redirect URL.'));
            return;
          }
          
          const { tokens } = await oauth2Client.getToken(code);
          oauth2Client.setCredentials(tokens);
          
          console.log('\n✅ Authorization successful!');
          if (tokens.refresh_token) {
            console.log('Refresh token obtained. You can use this to refresh access tokens.');
            console.log('\n🔑 REFRESH TOKEN (save this to Secret Manager):');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(tokens.refresh_token);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
          } else {
            console.log('⚠️  No refresh token received. This may happen if you already authorized before.');
            console.log('   To get a new refresh token, revoke access at: https://myaccount.google.com/permissions');
            console.log('   Then run this script again.\n');
          }
          
          resolve(oauth2Client);
        } catch (error) {
          reject(error);
        }
      });
    } else {
      // Automatic flow: Start local server to receive callback
      const server = http.createServer(async (req, res) => {
        try {
          // Use WHATWG URL API instead of deprecated url.parse()
          const baseUrl = `http://${req.headers.host || 'localhost:3000'}`;
          const url = new URL(req.url, baseUrl);
          const code = url.searchParams.get('code');
          const error = url.searchParams.get('error');
          
          if (error) {
            res.writeHead(400);
            res.end('Error: ' + error);
            server.close();
            reject(new Error(error));
            return;
          }
          
          if (code) {
            res.writeHead(200);
            res.end('Authorization successful! You can close this window.');
            server.close();
            
            const { tokens } = await oauth2Client.getToken(code);
            oauth2Client.setCredentials(tokens);
            
            console.log('\n✅ Authorization successful!');
            if (tokens.refresh_token) {
              console.log('Refresh token obtained. You can use this to refresh access tokens.');
              console.log('\n🔑 REFRESH TOKEN (save this to Secret Manager):');
              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              console.log(tokens.refresh_token);
              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            } else {
              console.log('⚠️  No refresh token received. This may happen if you already authorized before.');
              console.log('   To get a new refresh token, revoke access at: https://myaccount.google.com/permissions');
              console.log('   Then run this script again.\n');
            }
            
            resolve(oauth2Client);
          } else {
            res.writeHead(400);
            res.end('No authorization code received');
          }
        } catch (error) {
          res.writeHead(500);
          res.end('Error: ' + error.message);
          server.close();
          reject(error);
        }
      }).listen(3000, () => {
        console.log('\nWaiting for authorization callback on ' + redirectUri);
        console.log('If the browser does not open automatically, copy the URL above and open it in your browser.');
        console.log('\n⚠️  Lưu ý: Nếu gặp lỗi "redirect_uri_mismatch" hoặc "connection refused":');
        console.log('   1. Vào Google Cloud Console > APIs & Services > Credentials');
        console.log('   2. Click vào OAuth Client ID của bạn');
        console.log('   3. Thêm redirect URI sau vào "Authorized redirect URIs":');
        console.log('      ' + redirectUri);
        console.log('   4. Click SAVE và thử lại');
        console.log('\n💡 Tip: Nếu chạy trên Cloud Shell, set MANUAL_FLOW=true để dùng manual flow:\n');
        console.log('   export MANUAL_FLOW=true');
        console.log('   node scripts/setup-gmail-watch.js\n');
      });
    }
  });
}

async function setupGmailWatch() {
  try {
    const projectId = process.env.GCP_PROJECT_ID;
    const topicName = process.env.PUBSUB_TOPIC || 'gmail-notifications';
    
    if (!projectId) {
      throw new Error('GCP_PROJECT_ID environment variable is required');
    }
    
    // Get OAuth2 client
    const auth = await getAccessToken();
    
    // Initialize Gmail API
    const gmail = google.gmail({ version: 'v1', auth });
    
    // Construct topic path
    const topicPath = `projects/${projectId}/topics/${topicName}`;
    
    console.log(`Setting up Gmail Watch for topic: ${topicPath}`);
    
    // Setup watch
    const watchRequest = {
      labelIds: ['INBOX'], // Monitor INBOX
      topicName: topicPath,
    };
    
    const response = await gmail.users.watch({
      userId: 'me',
      requestBody: watchRequest,
    });
    
    console.log('\n✅ Gmail Watch setup successful!');
    console.log(`History ID: ${response.data.historyId}`);
    console.log(`Expiration: ${new Date(parseInt(response.data.expiration)).toISOString()}`);
    console.log('\n⚠️  Important Notes:');
    console.log('   - Watch requests expire after 7 days');
    console.log('   - You need to renew the watch before expiration');
    console.log('   - Consider using Cloud Scheduler to run this script weekly');
    console.log('\nTo renew the watch, run this script again before expiration.');
    
  } catch (error) {
    console.error('Error setting up Gmail Watch:', error);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    
    process.exit(1);
  }
}

// Run setup
setupGmailWatch();


