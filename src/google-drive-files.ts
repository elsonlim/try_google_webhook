import "dotenv/config";

import {
  createAuthenticatedClientWithKeyFilePath,
  GoogleDriveObject,
} from "./google-helper";

async function findFile(fileId: string) {
  try {
    const authClient = createAuthenticatedClientWithKeyFilePath(
      "service-account-key.json"
    );

    const drive = new GoogleDriveObject(authClient);

    const response = await drive.getFile(fileId);

    const file = response;
    console.log(file);
  } catch (error) {
    console.error("Error listing files:", error);
  }
}

const fileId = "asdf";
findFile(fileId);
