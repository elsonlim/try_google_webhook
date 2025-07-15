// example of notion integration to a database
import "dotenv/config";
import { Client, isFullPage } from "@notionhq/client";

const NOTION_TOKEN = process.env.NOTION_TOKEN; // Your Notion integration token
const NOTION_DATABASE_ID = `${process.env.NOTION_DATABASE_ID}`; // Your Notion database ID

console.log(NOTION_TOKEN, NOTION_DATABASE_ID);

if (!NOTION_TOKEN || !NOTION_DATABASE_ID) {
  console.error(
    "❌ Missing Notion token or database ID in .env file. Please check your configuration."
  );
  process.exit(1);
}

const notion = new Client({
  auth: NOTION_TOKEN,
});

async function addToDatabase() {
  try {
    const response = await notion.pages.create({
      parent: { database_id: NOTION_DATABASE_ID as string },
      properties: {
        Title: {
          title: [
            {
              text: {
                content: "Sample Title",
              },
            },
          ],
        },
        URL: {
          url: "https://example.com",
        },
        Type: {
          select: {
            name: "Sample Type",
          },
        },
      },
    });

    console.log("✅ Success! Entry added to your Notion database.");
    console.log(response);
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

addToDatabase();

// list all pages in the database
// async function listDatabasePages() {
//   try {
//     const response = await notion.databases.query({
//       database_id: NOTION_DATABASE_ID as string,
//     });

//     console.log("✅ Success! Found pages:");

//     // Filter for full pages and process them
//     for (const page of response.results) {
//       // 1. A type guard to ensure this is a full page object
//       if (!isFullPage(page)) {
//         console.log("This result is not a full page.");
//         continue;
//       }

//       // 2. Access the 'Name' property
//       const nameProperty = page.properties.Name;

//       // 3. Check if the 'Name' property is the correct 'title' type
//       if (nameProperty?.type === "title") {
//         // Now TypeScript knows nameProperty.title is safe to access
//         const title = nameProperty.title[0]?.plain_text || "Untitled";
//         console.log(`- ${title}`);
//       }
//     }
//   } catch (error: any) {
//     console.error("❌ Error:", error.body || error);
//   }
// }

// listDatabasePages();
