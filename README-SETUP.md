# Setting Up Google OAuth with Supabase

Follow these steps to properly configure Google OAuth with Supabase for your MatrixAI application.

## 1. Supabase Configuration

1. Log in to your Supabase project dashboard at https://app.supabase.co
2. Go to **Authentication** > **Providers**
3. Find and enable **Google** provider
4. Enter the following details:
   - **Client ID**: `1046714115920-vk3nng2cli9ggeo7cdg9jd87g1620bbk.apps.googleusercontent.com`
   - **Client Secret**: (Your Google client secret)
5. Add the following Redirect URLs:
   - `https://ddtgdhehxhgarkonvpfq.supabase.co/auth/v1/callback` (MOST IMPORTANT)
   - `matrixai://auth/callback` (if you want app redirects later)
6. Save changes

## 2. Google Cloud Console Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** > **Credentials**
4. Edit your OAuth 2.0 Client ID
5. Add the following Authorized Redirect URIs:
   - `https://ddtgdhehxhgarkonvpfq.supabase.co/auth/v1/callback` (EXACT MATCH - no trailing slashes)
6. Save changes

## 3. iOS Configuration

The URL scheme is already configured in your app, but you can verify it:
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleTypeRole</key>
    <string>Editor</string>
    <key>CFBundleURLName</key>
    <string>com.matrixai</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>matrixai</string>
    </array>
  </dict>
</array>
```

## 4. Fixing "redirect_uri_mismatch" Error

This error occurs when the redirect URI in your request doesn't match any URIs authorized in Google Cloud Console.

### Step-by-Step Fix:

1. **Verify the exact redirect URI your app is using**:
   - Run the app in development mode
   - Tap the debug button (if available) to see the exact redirect URI being used
   - You should see: `https://ddtgdhehxhgarkonvpfq.supabase.co/auth/v1/callback`

2. **Check Google Cloud Console**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to **APIs & Services** > **Credentials**
   - Find your OAuth 2.0 Client ID for the web application
   - Under "Authorized redirect URIs", verify that EXACTLY `https://ddtgdhehxhgarkonvpfq.supabase.co/auth/v1/callback` is listed
   - If it's missing or different (even by a slash), add or edit it
   - Common problems:
     - Missing trailing slash
     - Extra trailing slash
     - Typos in the domain
     - HTTP vs HTTPS

3. **Check Supabase Site URL**:
   - In Supabase Dashboard, go to **Project Settings** > **General**
   - Verify the Site URL is set correctly

4. **Verify Google client ID and secret**:
   - Make sure the Google client ID in your app matches what's in Supabase
   - Make sure the client secret in Supabase matches Google Cloud Console

## 5. Testing

After making these changes:
1. Close and restart your app
2. Try Google login again
3. If you still see errors, check the Console/Logs for any specific error messages

## 6. Common Error Solutions

1. **Server stopped responding**: This typically happens when the redirect URL is not properly configured. Ensure that all redirect URLs match exactly between Supabase and Google Cloud Console.

2. **Invalid client ID**: Make sure the client ID is correctly copied into both your app and Supabase settings.

3. **Error 400: redirect_uri_mismatch**: The redirect URI in your request doesn't match the ones authorized in your Google Cloud Console project.
