// Load environment variables from a .env file
import "dotenv/config";

import { google } from "googleapis";
import path from "path";

// Access credentials securely from environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

function createAuthenticatedClient() {
  const KEY_FILE_PATH = path.join(__dirname, "service-account-key.json");
  const SCOPES = ["https://www.googleapis.com/auth/drive.readonly"];
  const googleAuth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE_PATH,
    scopes: SCOPES,
  });
  return googleAuth; // Return the GoogleAuth object
}

async function findFile(fileId: string) {
  try {
    const authClient = createAuthenticatedClient();
    const drive = google.drive({ version: "v3", auth: authClient });

    const response = await drive.files.get({
      fileId: fileId,
      fields: "*",
    });

    const file = response.data;
    console.log(file);
  } catch (error) {
    console.error("Error listing files:", error);
  }
}

const fileId = "1978G498vjqn57pIhn0jMmKRmcuPPad2n";
findFile(fileId);
