import "dotenv/config";

import { google } from "googleapis";
import { v4 as uuidv4 } from "uuid";
import path from "path";

export function createAuthenticatedClientWithRefreshToken(
  GOOGLE_REFRESH_TOKEN: string
) {
  if (!GOOGLE_REFRESH_TOKEN || GOOGLE_REFRESH_TOKEN.length === 0) {
    throw new Error("GOOGLE_REFRESH_TOKEN is required for authentication.");
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error(
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required for authentication."
    );
  }

  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oAuth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  return oAuth2Client;
}

export function createAuthenticatedClientWithKeyFilePath() {
  const KEY_FILE_PATH = path.join(__dirname, "service-account-key.json");

  console.log({ KEY_FILE_PATH });

  // The scopes define the level of access you are requesting.
  // 'drive.readonly' is for viewing files, 'drive' is for full access.
  const SCOPES = ["https://www.googleapis.com/auth/drive.readonly"];

  const oAuth2Client = new google.auth.GoogleAuth({
    keyFile: KEY_FILE_PATH,
    scopes: SCOPES,
  });

  return oAuth2Client;
}

export async function setupDriveWebhook(
  WEBHOOK_URL: string,
  google_refresh_token?: string
) {
  try {
    const useGoogleRefreshToken =
      !!google_refresh_token && google_refresh_token.length > 0;
    if (useGoogleRefreshToken) {
      console.log("Using refresh token for authentication.");
    } else {
      console.log("Using service account key file for authentication.");
    }

    const authClient = useGoogleRefreshToken
      ? createAuthenticatedClientWithRefreshToken(google_refresh_token)
      : createAuthenticatedClientWithKeyFilePath();

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

    const returnData = {
      webhookId: webhookId,
      startPageToken: startPageToken,
      channelId: watchResponse.data.id,
      resourceId: watchResponse.data.resourceId,
    };

    console.log({
      message: "register successfully",
      ...returnData,
      expiration: new Date(
        Number(watchResponse.data.expiration)
      ).toLocaleString(),
    });

    return returnData;
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
    return "📝 Document";
  if (mimeType.startsWith("image/")) return "🖼️ Image";
  if (mimeType.startsWith("video/")) return "🎥 Video";
  return "Other";
}
