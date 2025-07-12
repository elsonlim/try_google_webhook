// Load environment variables from a .env file
import "dotenv/config";

import { google } from "googleapis";
import { v4 as uuidv4 } from "uuid";

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

async function findFile(fileId: string) {
  try {
    const authClient = createAuthenticatedClient();
    const drive = google.drive({ version: "v3", auth: authClient });

    // List files in Google Drive

    const response = await drive.files.get({
      fileId: fileId,
      fields: "*", // Specify the fields you want to retrieve
    });

    const file = response.data;
    console.log(file);
  } catch (error) {
    console.error("Error listing files:", error);
  }
}

const fileId = "1Gf6RZaC1qMfRO2GAjC7XLmFLoa7lQVee"; // The x-google-resource-id is the file ID
findFile(fileId);
