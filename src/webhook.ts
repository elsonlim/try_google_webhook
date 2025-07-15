import * as dotenv from "dotenv";
dotenv.config();
import { google } from "googleapis";
import express, { Request, Response } from "express";
import serverless from "serverless-http";
import { Client, isFullPage } from "@notionhq/client";
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
} from "./google-helper";

const app = express();

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);
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
  const Map = req.body.Map as string;
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

  const data = await docClient.send(
    new PutCommand({
      TableName: "TryGoogleDriveWebhookCounter",
      Item: {
        id: webhookId,
        count: startPageToken,
        channelId,
        resourceId,
        notion_token: NOTION_TOKEN,
        map: Map,
        google_refresh_token: GOOGLE_REFRESH_TOKEN,
      },
    })
  );

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
    [key: string]: { value: string };
  }

  const pageToken = data.Item ? (data.Item.count as string) : ("0" as string);
  // const google_refresh_token = data?.Item?.google_refresh_token as string;
  const notion_token = data?.Item?.notion_token as string;
  const googleDriveFolderNameToNotionDbIdMap = data?.Item
    ?.map as DynamoDbStringMap;

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
    : createAuthenticatedClientWithKeyFilePath();

  const drive = google.drive({ version: "v3", auth: authClient });

  const changesResponse = await drive.changes.list({
    pageToken,
    fields:
      "nextPageToken, newStartPageToken, changes(kind, type, removed, file(parents, id, name, mimeType, trashed, explicitlyTrashed, webViewLink))",
  });

  // IMPORTANT: Save the 'newStartPageToken' for your next call
  console.log({
    changesResponse: JSON.stringify(changesResponse, null, 2),
    data: JSON.stringify(changesResponse.data),
  });
  const newStartPageToken = changesResponse.data.newStartPageToken;

  console.log("old Page Token:", pageToken);
  console.log("New Start Page Token:", newStartPageToken);

  if (pageToken === newStartPageToken) {
    console.log("No new changes found.");
    res.status(200).send("No new changes found.");
    return;
  }

  const changes = changesResponse.data.changes || [];
  if (changes.length > 0) {
    console.log({ "number of changes": changes.length, changes: changes });

    const NOTION_TOKEN = process.env.NOTION_TOKEN; // Your Notion integration token
    const NOTION_DATABASE_ID = `${process.env.NOTION_DATABASE_ID}`; // Your Notion database ID

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

        const parent = await drive.files.get({
          fileId: item.parentId as string,
          fields: "name, id, parents",
        });

        let itemBy;
        let notionDBToInsert;
        // check if parent exists in the map key
        if (
          !googleDriveFolderNameToNotionDbIdMap[
            parent.data.name?.trim() as string
          ]
        ) {
          console.log(
            `Parent folder ${parent.data.name} not found in the map.`
          );

          if (parent.data.parents?.[0]) {
            console.log(
              `Parent folder ${parent.data.name} has a parent, checking further.`
            );

            const parentOfParent = await drive.files.get({
              fileId: parent.data.parents?.[0] as string,
              fields: "name, id, parents",
            });

            if (
              googleDriveFolderNameToNotionDbIdMap[
                parentOfParent?.data?.name as string
              ]
            ) {
              notionDBToInsert =
                googleDriveFolderNameToNotionDbIdMap[
                  parentOfParent.data.name as string
                ];
              itemBy = parentOfParent.data.name as string;
            }
          } else {
            console.log(
              `Parent folder ${parent.data.name} has no parent, skipping further checks.`
            );
            return;
          }
        } else {
          // get notion database ID from the map
          notionDBToInsert =
            googleDriveFolderNameToNotionDbIdMap[
              parent.data.name?.trim() as string
            ];
          itemBy = parent.data.name as string;
        }

        if (!notionDBToInsert || !itemBy) {
          console.log(`No Notion database found for ${item.Title}`);
          return;
        }

        item.By = itemBy;

        await notion.pages.create({
          parent: { database_id: NOTION_DATABASE_ID as string },
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
            URL: {
              url: item.URL as string,
            },
            Type: {
              multi_select: [{ name: item.Type as string }],
            },
            By: {
              select: {
                name: item.By as string,
              },
            },
          },
        });
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

  let headersText = "";

  for (let key in req.headers) {
    headersText += `Header: ${key}, Value: ${req.headers[key]}\n`;
  }

  console.log({ headersText, updatedData, "final message": "end of webhook" });

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

// A simple root path for health checks
app.get("/", (req: Request, res: Response) => {
  res.status(200).json({ message: "Server is running!" });
});

// Export the app wrapped in the serverless-http handler
export const handler = serverless(app);
