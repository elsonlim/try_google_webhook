import "dotenv/config";

import { google } from "googleapis";
import { v4 as uuidv4 } from "uuid";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

export function createAuthenticatedClient(GOOGLE_REFRESH_TOKEN: string) {
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oAuth2Client.setCredentials({
    refresh_token: GOOGLE_REFRESH_TOKEN,
  });

  return oAuth2Client;
}

export async function setupDriveWebhook(
  GOOGLE_REFRESH_TOKEN: string,
  WEBHOOK_URL: string
) {
  if (!WEBHOOK_URL || !GOOGLE_REFRESH_TOKEN) {
    throw new Error(
      "WEBHOOK_URL or GOOGLE_REFRESH_TOKEN is not defined in .env file."
    );
  }

  try {
    const authClient = createAuthenticatedClient(GOOGLE_REFRESH_TOKEN);
    const drive = google.drive({ version: "v3", auth: authClient });

    const webhookId = uuidv4();

    // 1. Get the starting point for changes.
    console.log("Fetching the start page token...");
    const tokenResponse = await drive.changes.getStartPageToken({});
    const startPageToken = tokenResponse.data.startPageToken;

    if (!startPageToken) {
      throw new Error("Failed to retrieve a valid start page token.");
    }

    console.log(`Successfully retrieved start page token.`);

    // 2. Use the token to register the webhook.
    console.log(`Registering webhook at: ${WEBHOOK_URL}/${webhookId}`);
    const watchResponse = await drive.changes.watch({
      pageToken: startPageToken,
      requestBody: {
        id: webhookId,
        type: "web_hook",
        address: `${WEBHOOK_URL}/${webhookId}`,
      },
    });

    // 3. Log the successful registration details.
    console.log(
      "\n✅ Webhook registered successfully!: " +
        webhookId +
        "with startPagetoken: " +
        startPageToken
    );
    console.log(`   Channel ID: ${watchResponse.data.id}`);
    console.log(`   Resource ID: ${watchResponse.data.resourceId}`);
    console.log(
      `   Expiration: ${new Date(
        Number(watchResponse.data.expiration)
      ).toLocaleString()}`
    );

    return {
      webhookId: webhookId,
      startPageToken: startPageToken,
      channelId: watchResponse.data.id,
      resourceId: watchResponse.data.resourceId,
    };
  } catch (error) {
    // Log any errors that occur during the process.
    if (error instanceof Error) {
      console.error("❌ Error setting up webhook:", error.message);
    } else {
      console.error("❌ An unknown error occurred:", error);
    }
  }
}

export function getTypeFromMime(mimeType: string): string {
  if (
    mimeType === "application/pdf" ||
    mimeType === "application/msword" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/vnd.ms-excel" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-powerpoint" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    mimeType === "text/plain" ||
    mimeType === "text/csv"
  )
    return "Document";
  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType.startsWith("video/")) return "Video";
  return "Other";
}
