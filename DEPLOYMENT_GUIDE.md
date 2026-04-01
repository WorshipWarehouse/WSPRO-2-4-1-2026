# Deployment Guide - Google AI Studio

This guide explains how to deploy your application to Google AI Studio and resolve common security cookie errors.

## Prerequisites
- A Google AI Studio account.
- An API key from [Google AI Studio](https://aistudio.google.com/apikey).

## Step 1: Configure Secrets
In the Google AI Studio UI, go to **Settings → Secrets** and add the following:

1. **GEMINI_API_KEY**: Your API key from Step 2.
2. **JWT_SECRET**: A long, random string for signing authentication tokens.

## Step 2: Environment Variables
The following variables are automatically managed by AI Studio:
- **APP_URL**: The URL where your app is hosted.
- **PORT**: The port the server listens on (usually 8080 in production).

## Step 3: Local Testing
To test your app locally before deploying:

1. Create a `.env.local` file:
   ```bash
   cp .env.example .env.local
   ```
2. Add your `GEMINI_API_KEY` to `.env.local`.
3. Run the development server:
   ```bash
   npm install
   npm run dev
   ```
4. Access your app at `http://localhost:3000`.

## Step 4: Verification
After deploying, verify your setup by visiting:
`https://your-app-url.run.app/api/config`

It should return a JSON object confirming the environment and API availability.
