// Load environment variables from a .env file
import "dotenv/config";

import { google } from "googleapis";
import { v4 as uuidv4 } from "uuid";

// Access credentials securely from environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

/**
 * Creates an authenticated OAuth2 client using credentials from the environment.
 * @returns {google.auth.OAuth2} An authenticated client object.
 */
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

/**
 * Gets a startPageToken and uses it to register a webhook for Google Drive changes.
 */
async function setupDriveWebhook() {
  if (!WEBHOOK_URL) {
    throw new Error("WEBHOOK_URL is not defined in .env file.");
  }

  try {
    const authClient = createAuthenticatedClient();
    const drive = google.drive({ version: "v3", auth: authClient });

    // 1. Get the starting point for changes.
    console.log("Fetching the start page token...");
    const tokenResponse = await drive.changes.getStartPageToken({});
    const startPageToken = tokenResponse.data.startPageToken;

    if (!startPageToken) {
      throw new Error("Failed to retrieve a valid start page token.");
    }

    console.log(`Successfully retrieved start page token.`);

    // 2. Use the token to register the webhook.
    console.log(`Registering webhook at: ${WEBHOOK_URL}`);
    const watchResponse = await drive.changes.watch({
      pageToken: startPageToken,
      requestBody: {
        id: uuidv4(), // A unique ID for this notification channel.
        type: "web_hook",
        address: WEBHOOK_URL,
      },
    });

    // 3. Log the successful registration details.
    console.log("\n✅ Webhook registered successfully!");
    console.log(`   Channel ID: ${watchResponse.data.id}`);
    console.log(`   Resource ID: ${watchResponse.data.resourceId}`);
    console.log(
      `   Expiration: ${new Date(
        Number(watchResponse.data.expiration)
      ).toLocaleString()}`
    );
  } catch (error) {
    // Log any errors that occur during the process.
    if (error instanceof Error) {
      console.error("❌ Error setting up webhook:", error.message);
    } else {
      console.error("❌ An unknown error occurred:", error);
    }
  }
}

async function disableWebhook() {
  const authClient = createAuthenticatedClient();
  const drive = google.drive({ version: "v3", auth: authClient });

  const resourceId = "KIktex1AmjnfPMPl_u3R4rIz_H4";

  const channels = [
    {
      id: "ae87e648-0499-4239-a871-370d235ca42d",
      resourceId,
    },
    {
      id: "5e7316d9-7a11-43b2-af38-fc6f3905ea51",
      resourceId,
    },
  ];

  for (const channel of channels) {
    await drive.channels.stop({
      requestBody: {
        id: channel.id,
        resourceId: channel.resourceId,
      },
    });
  }
}

// Run the main function.
// setupDriveWebhook();
disableWebhook();
