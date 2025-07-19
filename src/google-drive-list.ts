import "dotenv/config";
import {
  createAuthenticatedClientWithKeyFilePath,
  GoogleDriveObject,
} from "./google-helper";

async function listDriveFiles() {
  try {
    const authClient = createAuthenticatedClientWithKeyFilePath(
      "service-account-key.json"
    );
    const drive = new GoogleDriveObject(authClient);
    const response = await drive.getFileList();

    const files = response.files;
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
