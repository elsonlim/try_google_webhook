This process is in two parts:

Get Application Credentials (Client ID and Client Secret).

Get User Permission Credentials (Refresh Token).

Part 1: Get Your Application Credentials (Client ID & Secret) 🔑
These credentials identify your application to Google. You get them from the Google Cloud Console.

Go to the Google Cloud Console
Navigate to https://console.cloud.google.com/ and sign in with your Google account (this will be your developer account).

Create or Select a Project
Use an existing project or click the project dropdown at the top to create a New Project.

Enable the Google Drive API

In the sidebar menu (☰), go to APIs & Services > Library.

Search for "Google Drive API" and click on it.

Click the Enable button.

Configure the OAuth Consent Screen
This is the permission screen your users will see.

In the sidebar, go to APIs & Services > OAuth consent screen.

Select External for the User Type and click Create.

Fill in the required information:

App name: The name of your application.

User support email: Your email address.

Developer contact information: Your email address.

Click SAVE AND CONTINUE through the "Scopes" and "Test users" sections. You can leave them blank for now. Finally, click BACK TO DASHBOARD.

Create Your Credentials

In the sidebar, go to APIs & Services > Credentials.

Click + CREATE CREDENTIALS at the top and select OAuth client ID.

Specify Application Details

For Application type, select Web application.

Under Authorized redirect URIs, click + ADD URI.

Paste this exact URI: https://developers.google.com/oauthplayground. This allows you to easily get your user token in the next part.

Get Your Client ID and Secret

Click the CREATE button.

A pop-up will appear showing you Your Client ID and Your Client Secret.

Copy both of these values. You will need them for your .env file and for the next part.

Part 2: Get Your User Permission Credential (Refresh Token) 🎟️
This token represents a user's permission for your app to access their data. You will use the credentials from Part 1 to get this.

Open the OAuth 2.0 Playground
Go to https://developers.google.com/oauthplayground.

Configure the Playground

Click the gear icon (⚙️) on the top right.

Check the box for Use your own OAuth credentials.

Paste your Client ID and Client Secret into the fields.

Select and Authorize the API Scope

On the left side (Step 1), scroll down or type to find Drive API v3.

Click to expand it and select the scope: https://www.googleapis.com/auth/drive.

Click the blue Authorize APIs button.

Grant Permission

A Google sign-in window will open. Sign in to the Google account whose Drive you want to monitor (for testing, this is usually your own account).

Click Allow on the consent screen to grant permission to your app.

Exchange for Tokens

You will be redirected back to the playground. You will see an "Authorization code" has been filled in.

In Step 2, click the Exchange authorization code for tokens button.

Copy Your Refresh Token

On the right side (Step 3), the results will appear. Copy the Refresh token.

This is the final credential you need.

You now have all three credentials to put into your .env file:

GOOGLE_CLIENT_ID (from Part 1)

GOOGLE_CLIENT_SECRET (from Part 1)

GOOGLE_REFRESH_TOKEN (from Part 2)
