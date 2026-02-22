/**
 * Cloud Function: Gmail Pub/Sub Processor
 * 
 * Triggered by Pub/Sub messages from Gmail Watch
 * Processes new emails with PDF attachments and forwards to API endpoint
 * 
 * Environment Variables Required:
 * - GCP_PROJECT_ID: Google Cloud Project ID
 * - GCP_STORAGE_BUCKET: Cloud Storage bucket name
 * - API_BASE_URL: Base URL for API endpoint (Cloud Run URL) - REQUIRED
 * - DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD: Database connection
 * 
 * Secrets (via Secret Manager):
 * - GOOGLE_CLIENT_ID: OAuth2 Client ID
 * - GOOGLE_CLIENT_SECRET: OAuth2 Client Secret  
 * - OAUTH_REFRESH_TOKEN: Gmail OAuth2 refresh token
 */

const { google } = require('googleapis');
const axios = require('axios');

/**
 * Main Cloud Function entry point
 * Triggered by Pub/Sub message from Gmail Watch
 * 
 * Cloud Functions Gen2 uses CloudEvent format
 */
exports.processGmailNotification = async (cloudEvent) => {
  console.log('Received CloudEvent:', JSON.stringify(cloudEvent, null, 2));
  
  try {
    // Extract data from CloudEvent
    // Cloud Functions Gen2 with Pub/Sub trigger can have different formats:
    // Format 1: cloudEvent.data.message.data (wrapped)
    // Format 2: cloudEvent.data (direct base64 string)
    let base64Data;
    
    if (cloudEvent.data?.message?.data) {
      // Format 1: Wrapped format (Pub/Sub message wrapped in CloudEvent)
      base64Data = cloudEvent.data.message.data;
      console.log('Using wrapped format: cloudEvent.data.message.data');
    } else if (typeof cloudEvent.data === 'string') {
      // Format 2: Direct base64 string
      base64Data = cloudEvent.data;
      console.log('Using direct format: cloudEvent.data (string)');
    } else if (Buffer.isBuffer(cloudEvent.data)) {
      // Format 3: CloudEvent.data is a Buffer (Cloud Functions Gen2)
      base64Data = cloudEvent.data.toString('base64');
      console.log('Using buffer format: cloudEvent.data (Buffer)');
    } else if (cloudEvent.data?.data) {
      // Format 4: cloudEvent.data.data
      base64Data = cloudEvent.data.data;
      console.log('Using format: cloudEvent.data.data');
    } else {
      console.error('Invalid Pub/Sub message format');
      console.error('cloudEvent structure:', Object.keys(cloudEvent));
      console.error('cloudEvent.data type:', typeof cloudEvent.data);
      console.error('cloudEvent.data:', JSON.stringify(cloudEvent.data));
      if (cloudEvent.data) {
        console.error('cloudEvent.data keys:', Object.keys(cloudEvent.data));
      }
      return;
    }
    
    // Parse Pub/Sub message
    const messageData = JSON.parse(
      Buffer.from(base64Data, 'base64').toString()
    );
    
    console.log('Parsed message data:', JSON.stringify(messageData, null, 2));
    
    const emailAddress = messageData.emailAddress;
    const currentHistoryId = messageData.historyId;

    if (!emailAddress || !currentHistoryId) {
      console.error('Missing emailAddress or historyId in message');
      return;
    }

    // Get last processed history ID from storage (or use current if first run)
    // For simplicity, we use Gmail's profile to get the current historyId
    // and compare with what we received
    const gmail = await getGmailService();

    // Get current historyId from Gmail profile to verify
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const profileHistoryId = profile.data.historyId;
    console.log(`Current notification historyId: ${currentHistoryId}`);
    console.log(`Gmail profile historyId: ${profileHistoryId}`);

    // The notification's historyId should match or be close to profile's historyId
    // We need to query changes since our last processed historyId
    // For first run or if we don't have a stored lastHistoryId, we need to get it

    // Strategy: Use the notification's historyId as the END point
    // We need a START point (last processed historyId)
    // Since we don't have persistent storage in this simple implementation,
    // we'll use a different approach: query recent history with a limit

    // Get recent history (last 100 history changes)
    const history = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: currentHistoryId.toString(), // Use as start to see if there's anything AFTER
      historyTypes: ['messageAdded'],
      maxResults: 100,
    });

    // If no history returned, try getting history BEFORE this point
    if (!history.data.history || history.data.history.length === 0) {
      console.log('No new messages found in history (querying forward from notification historyId)');

      // Alternative: Try to get profile and use a historyId slightly before
      // This is a fallback for the initial setup
      try {
        // Get recent messages directly from inbox as fallback
        console.log('Fallback: Checking recent messages in INBOX...');
        const recentMessages = await gmail.users.messages.list({
          userId: 'me',
          labelIds: ['INBOX'],
          maxResults: 10,
        });

        if (recentMessages.data.messages && recentMessages.data.messages.length > 0) {
          console.log(`Found ${recentMessages.data.messages.length} recent messages in INBOX`);
          // Process these recent messages
          for (const msg of recentMessages.data.messages) {
            await processMessage(gmail, msg.id);
          }
        } else {
          console.log('No recent messages found in INBOX');
        }
      } catch (fallbackError) {
        console.error('Error in fallback message fetching:', fallbackError);
      }

      return;
    }
    
    // Process each new message
    const messageIds = new Set();
    for (const historyItem of history.data.history) {
      if (historyItem.messagesAdded) {
        for (const messageAdded of historyItem.messagesAdded) {
          messageIds.add(messageAdded.message.id);
        }
      }
    }
    
    console.log(`Found ${messageIds.size} new message(s)`);
    
    // Process each message
    for (const messageId of messageIds) {
      await processMessage(gmail, messageId);
    }
    
    console.log('Successfully processed all messages');
    
  } catch (error) {
    console.error('Error processing Gmail notification:', error);
    throw error; // Re-throw to trigger retry
  }
};

/**
 * Get Gmail API service instance using OAuth2 tokens
 * Uses refresh token from Secret Manager to get fresh access token
 */
async function getGmailService() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.OAUTH_REFRESH_TOKEN;
  
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required');
  }
  
  if (!refreshToken) {
    throw new Error('OAUTH_REFRESH_TOKEN is required. Please run setup-gmail-watch.js and store the refresh token in Secret Manager.');
  }
  
  // Create OAuth2 client
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  
  // Set refresh token
  oauth2Client.setCredentials({
    refresh_token: refreshToken
  });
  
  // Refresh access token
  console.log('Refreshing access token...');
  const { credentials } = await oauth2Client.refreshAccessToken();
  oauth2Client.setCredentials(credentials);
  console.log('Access token refreshed successfully');
  
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

/**
 * Process a single Gmail message
 */
async function processMessage(gmail, messageId) {
  try {
    console.log(`Processing message: ${messageId}`);
    
    // Get message details
    const message = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });
    
    const payload = message.data.payload;
    const headers = payload.headers || [];
    
    const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
    const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
    
    console.log(`Message subject: ${subject}`);
    console.log(`Message from: ${from}`);
    
    // Check if subject contains "Autoland" (case-insensitive filter)
    if (subject && !subject.toLowerCase().includes('autoland')) {
      console.log('Skipping message - subject does not contain "Autoland"');
      return;
    }
    
    // Find PDF attachments
    const pdfAttachments = findPdfAttachments(payload);
    
    if (pdfAttachments.length === 0) {
      console.log('No PDF attachments found in message');
      return;
    }
    
    console.log(`Found ${pdfAttachments.length} PDF attachment(s)`);
    
    // Process each PDF attachment
    for (const attachment of pdfAttachments) {
      await processPdfAttachment(gmail, messageId, attachment, subject, from);
    }
    
  } catch (error) {
    console.error(`Error processing message ${messageId}:`, error);
    throw error;
  }
}

/**
 * Find PDF attachments in message payload
 */
function findPdfAttachments(payload) {
  const attachments = [];
  
  function traverseParts(parts) {
    if (!parts) return;
    
    for (const part of parts) {
      if (part.filename && part.filename.toLowerCase().endsWith('.pdf')) {
        if (part.body && part.body.attachmentId) {
          attachments.push({
            filename: part.filename,
            attachmentId: part.body.attachmentId,
            mimeType: part.mimeType,
            size: part.body.size,
          });
        }
      }
      
      if (part.parts) {
        traverseParts(part.parts);
      }
    }
  }
  
  if (payload.parts) {
    traverseParts(payload.parts);
  } else if (payload.filename && payload.filename.toLowerCase().endsWith('.pdf')) {
    if (payload.body && payload.body.attachmentId) {
      attachments.push({
        filename: payload.filename,
        attachmentId: payload.body.attachmentId,
        mimeType: payload.mimeType,
        size: payload.body.size,
      });
    }
  }
  
  return attachments;
}

/**
 * Process a PDF attachment
 */
async function processPdfAttachment(gmail, messageId, attachment, emailSubject, emailFrom) {
  try {
    console.log(`Processing PDF attachment: ${attachment.filename}`);
    
    // Download PDF attachment
    const attachmentData = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId: messageId,
      id: attachment.attachmentId,
    });
    
    const pdfData = Buffer.from(attachmentData.data.data, 'base64');
    console.log(`PDF downloaded: ${pdfData.length} bytes`);
    
    // Check if API_BASE_URL is configured
    const apiBaseUrl = process.env.API_BASE_URL;
    
    if (!apiBaseUrl) {
      console.error('API_BASE_URL environment variable is required. Cannot process PDF without API endpoint.');
      console.error('PDF will be skipped. Please configure API_BASE_URL to enable PDF processing.');
      return;
    }
    
    // Call HTTP API endpoint for processing
    await callApiEndpoint(apiBaseUrl, pdfData, attachment.filename, emailSubject, emailFrom, messageId);
    
  } catch (error) {
    console.error(`Error processing PDF attachment ${attachment.filename}:`, error);
    throw error;
  }
}

/**
 * Call HTTP API endpoint to process PDF
 */
async function callApiEndpoint(apiBaseUrl, pdfData, filename, emailSubject, emailFrom, messageId) {
  try {
    // Use internal endpoint that doesn't require OAuth2
    const url = `${apiBaseUrl}/api/reports/process-internal`;
    
    let headers = {
      'Content-Type': 'application/json',
    };
    
    // Get identity token for Cloud Run authentication
    try {
      const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const client = await auth.getIdTokenClient(apiBaseUrl);
      const token = await client.idTokenProvider.fetchIdToken(apiBaseUrl);
      headers['Authorization'] = `Bearer ${token}`;
    } catch (authError) {
      console.warn('Could not get identity token, proceeding without auth:', authError.message);
    }
    
    const response = await axios.post(
      url,
      {
        pdfBase64: pdfData.toString('base64'),
        filename: filename,
        emailSubject: emailSubject,
        emailFrom: emailFrom,
        messageId: messageId,
      },
      {
        headers: headers,
        timeout: 300000, // 5 minutes timeout
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    );
    
    console.log('API endpoint response:', response.data);
    
    if (!response.data.success) {
      throw new Error(`API endpoint returned error: ${response.data.message || response.data.error}`);
    }
    
  } catch (error) {
    console.error('Error calling API endpoint:', error.response?.data || error.message);
    throw error;
  }
}
