// Load environment variables from a .env file
import "dotenv/config";

import { google } from "googleapis";
import { v4 as uuidv4 } from "uuid";
import path from "path";

// Access credentials securely from environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
import {
  createAuthenticatedClientWithKeyFilePath,
  createAuthenticatedClientWithRefreshToken,
} from "./google-helper";

async function listDriveFiles() {
  try {
    // const authClient = createAuthenticatedClientWithRefreshToken(
    //   process.env.GOOGLE_REFRESH_TOKEN || ""
    // );
    const authClient = createAuthenticatedClientWithKeyFilePath();
    const drive = google.drive({ version: "v3", auth: authClient });

    // List files in Google Drive
    console.log("Listing files in Google Drive...");
    const response = await drive.files.list({
      pageSize: 10, // Adjust the number of files to listcreateAuthenticatedClientWithRefreshToken
      fields: "nextPageToken, files(id, name, mimeType)",
      q: "trashed = false",
    });

    const files = response.data.files;
    if (files?.length) {
      console.log("Files:");
      files.forEach((file) => {
        console.log(file);
      });
    } else {
      console.log("No files found.");
    }
  } catch (error) {
    console.error("Error listing files:", error);
  }
}

listDriveFiles();
