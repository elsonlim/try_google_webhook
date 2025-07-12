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

async function listDriveFiles() {
  try {
    const authClient = createAuthenticatedClient();
    const drive = google.drive({ version: "v3", auth: authClient });

    // List files in Google Drive
    console.log("Listing files in Google Drive...");
    const response = await drive.files.list({
      pageSize: 10, // Adjust the number of files to list
      fields:
        "nextPageToken, newStartPageToken, changes(fileId, removed, file)",
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

const exampleFile = {
  parents: ["1Q4KJs1ZXhJB98iFaFkeyMQA6a5asJf3X"],
  kind: "drive#file",
  id: "1grXRox1xcypZLI1xkNKGFJHxrffooUTr",
  name: "cat2.jpg",
  mimeType: "image/jpeg",
  starred: false,
  trashed: false,
  explicitlyTrashed: false,
  version: "2",
  webContentLink:
    "https://drive.google.com/uc?id=1grXRox1xcypZLI1xkNKGFJHxrffooUTr&export=download",
  webViewLink:
    "https://drive.google.com/file/d/1grXRox1xcypZLI1xkNKGFJHxrffooUTr/view?usp=drivesdk",
  iconLink: "https://drive-thirdparty.googleusercontent.com/16/type/image/jpeg",
  hasThumbnail: true,
  thumbnailLink:
    "https://lh3.googleusercontent.com/drive-storage/AJQWtBPvz8o9IJF1XYXep2A5fDZv8AK4kqZsmZvS_MFmRmR-5CeLOuu_7lt0iJNg8fQx_4JPTLBMqtn88ZZsYPc434PUb40W95_kqEMwskPrjzbqCA=s220",
  thumbnailVersion: "1",
  originalFilename: "cat2.jpg",
  fullFileExtension: "jpg",
  fileExtension: "jpg",
};
