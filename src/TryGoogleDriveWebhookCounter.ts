import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  PutCommandOutput,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

interface WebhookCounterObject {
  id: string;
  count: string;
  channelId: string;
  resourceId: string;
  notion_token: string;
  map: Map<string, string>;
  google_refresh_token?: string;
}

export default class TryGoogleDriveWebhookCounter {
  private docClient: DynamoDBDocumentClient;

  constructor(dynamoDbClient: DynamoDBDocumentClient) {
    const client = new DynamoDBClient({
      region: process.env.DYNAMODB_REGION,
      endpoint: process.env.DYNAMODB_DB_ENDPOINT,
    });
    const docClient = DynamoDBDocumentClient.from(client);
    this.docClient = docClient;
  }

  async insertWebHookCounter(
    webhookObj: WebhookCounterObject
  ): Promise<PutCommandOutput> {
    const data = await this.docClient.send(
      new PutCommand({
        TableName: "TryGoogleDriveWebhookCounter",
        Item: webhookObj,
      })
    );

    return data;
  }
}
