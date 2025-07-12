// Load environment variables from a .env file
import "dotenv/config";

import { google } from "googleapis";

// Access credentials securely from environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

function createAuthenticatedClient() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error(
      "Missing Google credentials in .env file. Please check your configuration."
    );
  }

  const oAuth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET
  );

  oAuth2Client.setCredentials({
    refresh_token: GOOGLE_REFRESH_TOKEN,
  });

  return oAuth2Client;
}

async function findChanges() {
  try {
    const authClient = createAuthenticatedClient();
    const drive = google.drive({ version: "v3", auth: authClient });
    // Get the latest page token for changes
    const tokenResponse = await drive.changes.getStartPageToken();
    const latestPageToken = tokenResponse.data.startPageToken as string;
    console.log({ latestPageToken });

    // Now list the changes since the last time you checked
    // You should persist the 'newStartPageToken' after each run
    const changesResponse = await drive.changes.list({
      pageToken: "112", // Use the most recent token
      fields:
        "nextPageToken, changes(kind, type, removed, file(parents, id, name, mimeType, trashed, explicitlyTrashed, webViewLink))",
    });

    console.log({ changesResponse });

    const changes = changesResponse.data.changes || [];
    if (changes.length > 0) {
      console.log(`Found ${changes.length} changes.`);
      changes.forEach((change) => {
        console.log(change);
      });

      // IMPORTANT: Save the 'newStartPageToken' for your next call
      const newStartPageToken = changesResponse.data.newStartPageToken;
      // e.g., saveToDatabase(newStartPageToken);
    } else {
      console.log("No new changes found.");
    }
  } catch (error) {
    console.error("Error fetching changes:", error);
  }
}

findChanges();
