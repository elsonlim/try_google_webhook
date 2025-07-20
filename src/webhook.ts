import * as dotenv from "dotenv";
dotenv.config();
import express, { Request, Response } from "express";
import serverless from "serverless-http";
import { Client } from "@notionhq/client";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

import {
  setupDriveWebhook,
  createAuthenticatedClientWithKeyFilePath,
  createAuthenticatedClientWithRefreshToken,
  getTypeFromMime,
  GoogleDriveObject,
} from "./google-helper";
import TryGoogleDriveWebhookCounter from "./TryGoogleDriveWebhookCounter";

const app = express();

app.use((req, res, next) => {
  console.log({
    queryTime: `[${new Date().toISOString()}]`,
    url: `${req.method} ${req.originalUrl}`,
    headers: req.headers,
    body: req.body,
  });
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  if (Buffer.isBuffer(req.body)) {
    try {
      req.body = JSON.parse(req.body.toString());
    } catch (e) {}
  } else if (typeof req.body === "string") {
    try {
      req.body = JSON.parse(req.body);
    } catch (e) {}
  }
  next();
});

app.post("/register", async (req: Request, res: Response) => {
  const GOOGLE_REFRESH_TOKEN = req.body.GOOGLE_REFRESH_TOKEN as string;
  const NOTION_TOKEN = req.body.NOTION_TOKEN as string;
  const Map = req.body.Map as Map<string, string>;
  const WEBHOOK_URL = process.env.WEBHOOK_URL as string;

  const registerDetails = await setupDriveWebhook(
    WEBHOOK_URL,
    GOOGLE_REFRESH_TOKEN
  );

  const webhookId = registerDetails?.webhookId;
  const startPageToken = registerDetails?.startPageToken;
  const channelId = registerDetails?.channelId;
  const resourceId = registerDetails?.resourceId;

  if (!webhookId) {
    console.error("Missing webhookId for DynamoDB item:", registerDetails);
    res.status(400).send("Missing webhookId");
    return;
  }

  console.log("Webhook details saved to DynamoDB.");
  const client = new DynamoDBClient({
    region: process.env.DYNAMODB_REGION,
    endpoint: process.env.DYNAMODB_DB_ENDPOINT,
  });
  const docClient = DynamoDBDocumentClient.from(client);
  const GoogleDriveWebhookCounter = new TryGoogleDriveWebhookCounter(docClient);

  if (!startPageToken || !channelId || !resourceId) {
    console.error(
      "Missing required fields for DynamoDB item:",
      registerDetails
    );
    res.status(400).send("Missing required fields");
    return;
  }

  const data = GoogleDriveWebhookCounter.insertWebHookCounter({
    id: webhookId,
    count: startPageToken,
    channelId,
    resourceId,
    notion_token: NOTION_TOKEN,
    map: Map,
    google_refresh_token: GOOGLE_REFRESH_TOKEN,
  });

  res.status(200).send({ data });
});

app.post("/webhook/:webhookId", async (req: Request, res: Response) => {
  const webhookId = req.params.webhookId;

  const client = new DynamoDBClient({
    region: process.env.DYNAMODB_REGION,
    endpoint: process.env.DYNAMODB_DB_ENDPOINT,
  });

  const docClient = DynamoDBDocumentClient.from(client);

  const data = await docClient.send(
    new GetCommand({
      TableName: "TryGoogleDriveWebhookCounter",
      Key: { id: webhookId },
    })
  );

  interface DynamoDbStringMap {
    [key: string]: string;
  }

  const pageToken = data.Item ? (data.Item.count as string) : ("0" as string);
  const notion_token = data?.Item?.notion_token as string;
  const googleDriveFolderNameToNotionDbIdMap = data?.Item
    ?.map as DynamoDbStringMap;

  console.log({ googleDriveFolderNameToNotionDbIdMap });

  console.log(
    `Webhook ID: ${webhookId}
    \nPage Token: ${pageToken}\nChannel ID: ${
      data?.Item?.channelId
    }\nResource ID: ${
      data?.Item?.resourceId
    }\nNotion Token: ${notion_token}\nMap: ${JSON.stringify(
      googleDriveFolderNameToNotionDbIdMap
    )}`
  );

  const google_refresh_token = data?.Item?.google_refresh_token as string;

  const authClient = google_refresh_token
    ? createAuthenticatedClientWithRefreshToken(google_refresh_token)
    : createAuthenticatedClientWithKeyFilePath("service-account-key.json");

  // const drive = google.drive({ version: "v3", auth: authClient });
  const drive = new GoogleDriveObject(authClient);

  if (!googleDriveFolderNameToNotionDbIdMap) {
    console.error(
      `Google Drive folder to Notion DB map is missing in the request body.\n Webhook ID: ${webhookId}`
    );
    drive.deregisterWebhook(
      req.headers["x-goog-channel-id"] as string,
      req.headers["x-goog-resource-id"] as string
    );
    res
      .status(400)
      .send(
        "Missing Google Drive folder to Notion DB map, deregistering webhook."
      );
    return;
  }

  const changesResponse = await drive.getChanges(pageToken + "");
  const changes = changesResponse.changes || [];
  const newStartPageToken = changesResponse.newStartPageToken;

  console.log({ changes, curPageStartToken: pageToken, newStartPageToken });

  if (pageToken === newStartPageToken) {
    console.log("No new changes found.");
    res.status(200).send("No new changes found.");
    return;
  }
  if (changes.length > 0) {
    console.log({ "number of changes": changes.length, changes: changes });

    const NOTION_TOKEN = process.env.NOTION_TOKEN; // Your Notion integration token

    const notion = new Client({
      auth: NOTION_TOKEN,
    });

    const items = changes
      .filter(
        (change) =>
          change.file &&
          change.file.trashed === false &&
          change.type === "file" &&
          change.file.mimeType !== "application/vnd.google-apps.folder"
      )
      .map((item) => {
        const updateItem = {
          id: item?.file?.id,
          name: item?.file?.name?.replace(/\.[^/.]+$/, ""),
          mimeType: item?.file?.mimeType,
          webViewLink: item?.file?.webViewLink,
          parent: item?.file?.parents && item?.file?.parents[0],
          parents: item?.file?.parents,
        };

        console.log(updateItem);
        return updateItem;
      })
      .map((item) => {
        return {
          id: item.id,
          Title: item.name,
          URL: item.webViewLink,
          Type: getTypeFromMime(item?.mimeType as string),
          By: "",
          parentId: item.parent,
        };
      });

    await Promise.all(
      items.map(async (item) => {
        const record = await docClient.send(
          new GetCommand({
            TableName: "TryGoogleDriveWebhookFileRecord",
            Key: { id: item.id },
          })
        );

        if (record.Item) {
          console.log(`File ${item.id} already exists in the record.`);
          return;
        } else {
          await docClient.send(
            new PutCommand({
              TableName: "TryGoogleDriveWebhookFileRecord",
              Item: {
                id: item.id,
                expiresAt: Math.floor(Date.now() / 1000) + 10, // 10 seconds
              },
            })
          );
        }

        const parent = await drive.getFile(item.parentId as string);

        let itemBy;
        let notionDBToInsert;
        // check if parent exists in the map key
        if (
          !googleDriveFolderNameToNotionDbIdMap[parent.name?.trim() as string]
        ) {
          console.log(`Parent folder ${parent.name} not found in the map.`);

          if (parent.parents?.[0]) {
            console.log(
              `Parent folder ${parent.name} has a parent, checking further.`
            );

            const parentOfParent = await drive.getFile(
              parent.parents?.[0] as string
            );

            if (
              googleDriveFolderNameToNotionDbIdMap[
                parentOfParent?.name as string
              ]
            ) {
              notionDBToInsert =
                googleDriveFolderNameToNotionDbIdMap[
                  parentOfParent.name as string
                ];
              itemBy = parentOfParent.name as string;
            }
          } else {
            console.log(
              `Parent folder ${parent.name} has no parent, skipping further checks.`
            );
            return;
          }
        } else {
          // get notion database ID from the map
          notionDBToInsert =
            googleDriveFolderNameToNotionDbIdMap[parent.name?.trim() as string];
          itemBy = parent.name as string;
        }

        if (!notionDBToInsert || !itemBy) {
          console.log(`No Notion database found for ${item.Title}`);
          return;
        }

        item.By = itemBy;

        console.log({
          notionDBToInsert,
        });

        const notionResponse = await notion.pages.create({
          parent: { database_id: notionDBToInsert as string },
          properties: {
            Title: {
              title: [
                {
                  text: {
                    content: item.Title as string,
                  },
                },
              ],
            },
            // URL: {
            //   url: item.URL as string,
            // },
            // Type: {
            //   multi_select: [{ name: item.Type as string }],
            // },
            // By: {
            //   select: {
            //     name: item.By as string,
            //   },
            // },
          },
        });

        console.log({ notionResponse });
      })
    );
  } else {
    console.log("No new changes found.");
  }

  const updatedData = await docClient.send(
    new UpdateCommand({
      TableName: "TryGoogleDriveWebhookCounter",
      Key: { id: webhookId },
      UpdateExpression: "SET #count = :newCount",
      ExpressionAttributeNames: {
        "#count": "count",
      },
      ExpressionAttributeValues: {
        ":newCount": newStartPageToken,
      },
      ReturnValues: "ALL_NEW", // Optional: returns the updated item
    })
  );

  console.log({ updatedData, "final message": "end of webhook" });

  res.status(200).send("OK");
});

app.post("/counter", async (req: Request, res: Response) => {
  const client = new DynamoDBClient({
    region: process.env.DYNAMODB_REGION,
    endpoint: process.env.DYNAMODB_DB_ENDPOINT,
  });
  const docClient = DynamoDBDocumentClient.from(client);

  const before = await docClient.send(
    new GetCommand({
      TableName: "TryGoogleDriveWebhookCounter",
      Key: { id: "counter" },
    })
  );

  const count = before.Item ? Number(before.Item.count) + 1 : 1;

  const data = await docClient.send(
    new PutCommand({
      TableName: "TryGoogleDriveWebhookCounter",
      Item: {
        id: "counter",
        count: String(count),
      },
    })
  );

  console.log("Counter saved:", data);
  res.status(200).json({ message: "Counter received", count });
});

app.get("/", (req: Request, res: Response) => {
  res.status(200).json({ message: "Server is running!" });
});

export const handler = serverless(app);
