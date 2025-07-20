// example of notion integration to a database
import "dotenv/config";
import { Client, GetDatabaseResponse, isFullPage } from "@notionhq/client";

const NOTION_TOKEN = process.env.NOTION_TOKEN; // Your Notion integration token
const NOTION_DATABASE_ID = `${process.env.NOTION_DATABASE_ID}`; // Your Notion database ID

class NotionDatabase {
  private client: Client;
  private databaseId: string;

  constructor(token: string, databaseId: string) {
    if (!token || !databaseId) {
      console.warn("❌ Missing Notion token or database ID");
    }
    this.client = new Client({ auth: token });
    this.databaseId = databaseId;
  }

  async listDatabasePages() {
    try {
      const response = await this.client.databases.query({
        database_id: this.databaseId,
      });

      for (const page of response.results) {
        if (isFullPage(page)) {
          if (page.properties.Title?.type === "title") {
            console.log(page.properties.Title.title[0]?.plain_text);
          } else {
            console.log("Title property is not of type 'title'");
          }
        } else {
          console.log("No properties found");
        }
      }
    } catch (error) {
      console.error("Error listing database pages:", error);
    }
  }

  async showDatabaseFields() {
    try {
      const response = (await this.client.databases.retrieve({
        database_id: this.databaseId,
      })) as GetDatabaseResponse;

      const responseTitle =
        (response as any).title[0]?.plain_text ?? "(no name)";

      // console.log("Database fields:", response.properties);
      console.log(`${responseTitle} Database Fields: Name and Type`);
      for (const property of Object.values(response.properties)) {
        console.log(`- ${property.name}: ${property.type}`);
      }
    } catch (error) {
      console.error("Error retrieving database fields:", error);
    }
  }

  async deletePageByFileName(fileName: string) {
    try {
      const response = await this.client.databases.query({
        database_id: this.databaseId,
        filter: {
          property: "Title",
          title: {
            equals: fileName,
          },
        },
      });

      console.log(
        `Found ${response.results.length} pages with the file name "${fileName}"`
      );

      for (const page of response.results) {
        await this.client.pages.update({
          page_id: page.id,
          archived: true, // Notion API "deletes" by archiving
        });
        console.log(`Archived page: ${page.id}`);
      }
    } catch (error) {
      console.error("Error deleting page by file name:", error);
    }
  }

  async addPageToDatabase(
    title: string,
    url: string,
    type: string,
    notionDBToInsert: string
  ) {
    try {
      const response = await this.client.pages.create({
        parent: { database_id: notionDBToInsert },
        properties: {
          Title: {
            title: [
              {
                text: {
                  content: title,
                },
              },
            ],
          },
          URL: {
            url: url,
          },
          Type: {
            select: {
              name: type,
            },
          },
        },
      });

      console.log("✅ Success! Entry added to your Notion database.");
      console.log(response);
    } catch (error) {
      console.error("❌ Error adding page to database:", error);
    }
  }
}

const notionObject = new NotionDatabase(
  NOTION_TOKEN as string,
  NOTION_DATABASE_ID as string
);
notionObject.showDatabaseFields().catch(console.error);
