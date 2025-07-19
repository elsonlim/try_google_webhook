import "dotenv/config";
import {
  createAuthenticatedClientWithKeyFilePath,
  GoogleDriveObject,
} from "./google-helper";

async function findChanges() {
  try {
    const authClient = createAuthenticatedClientWithKeyFilePath(
      "service-account-key.json"
    );

    const drive = new GoogleDriveObject(authClient);

    const tokenResponse = await drive.getStartPageToken();
    const latestPageToken = tokenResponse.startPageToken as string;
    console.log({ latestPageToken });

    const changesResponse = await drive.getChanges("1608");

    console.log({ changesResponse });

    const changes = changesResponse.changes || [];
    if (changes.length > 0) {
      console.log(`Found ${changes.length} changes.`);
      changes.forEach((change) => {
        console.log(change);
      });

      const newStartPageToken = changesResponse.newStartPageToken;
      const nextPageToken = changesResponse.nextPageToken;
      console.log({ newStartPageToken, nextPageToken });
    } else {
      console.log("No new changes found.");
    }
  } catch (error) {
    console.error("Error fetching changes:", error);
  }
}

findChanges();
