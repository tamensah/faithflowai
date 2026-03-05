# Setting Up Single Sign-On (SSO) for FaithFlow

This guide provides detailed instructions for setting up Single Sign-On (SSO) with Google, Facebook, and Apple for FaithFlow. Each service requires specific configuration steps and credentials that need to be added to your `.env` file.

## Table of Contents
- [Google OAuth Setup](#google-oauth-setup)
- [Facebook OAuth Setup](#facebook-oauth-setup)
- [Apple Sign-in Setup](#apple-sign-in-setup)
- [Environment Variables](#environment-variables)
- [Testing Your Setup](#testing-your-setup)

## Google OAuth Setup

### Step 1: Create a Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click on the project dropdown at the top
3. Click "New Project"
4. Name: "FaithFlow" (or your preferred name)
5. Click "Create"

### Step 2: Enable OAuth API
1. In the left sidebar, go to "APIs & Services" > "Library"
2. Search for "Google Identity Services"
3. Click "Enable"

### Step 3: Configure OAuth Consent Screen
1. Go to "APIs & Services" > "OAuth consent screen"
2. Select "External" user type
3. Fill in the required information:
   - App name: "FaithFlow"
   - User support email: Your email
   - Developer contact information: Your email
4. Click "Save and Continue"
5. Add scopes:
   - Select "email" and "profile"
   - These are the minimum required scopes
6. Click "Save and Continue"
7. Add test users (optional):
   - Add your email and any other test users
   - This is only required during development/testing
8. Click "Save and Continue"

### Step 4: Create OAuth Credentials
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Choose "Web application"
4. Name: "FaithFlow Web Client"
5. Add Authorized JavaScript origins:
   ```
   http://localhost:3000
   ```
6. Add Authorized redirect URIs:
   ```
   http://localhost:3001/auth/google/callback
   ```
   > ⚠️ **Important**: The redirect URI must exactly match what's in your .env file. Common issues:
   > - Missing or extra trailing slash
   > - Wrong port number
   > - HTTP vs HTTPS mismatch
   > - Localhost vs domain name mismatch

7. Click "Create"
8. Copy the Client ID and Client Secret and update your .env file:
   ```env
   GOOGLE_CLIENT_ID="your-client-id"
   GOOGLE_CLIENT_SECRET="your-client-secret"
   GOOGLE_REDIRECT_URI="http://localhost:3001/auth/google/callback"
   ```

### Step 5: Configure Production URLs
When deploying to production, you'll need to:
1. Add your production domain to Authorized JavaScript origins
2. Add your production callback URL to Authorized redirect URIs
3. Update your environment variables accordingly

For example:
```
https://faithflow.com
https://api.faithflow.com/auth/google/callback
```

## Facebook OAuth Setup

### Step 1: Create a Facebook App
1. Go to [Facebook Developers](https://developers.facebook.com)
2. Click "Create App"
3. Select "Consumer" as the app type
4. Fill in app details:
   - App Name: "FaithFlow"
   - App Contact Email: Your email
5. Click "Create App"

### Step 2: Configure Facebook Login
1. From the app dashboard, click "Add Product"
2. Find "Facebook Login" and click "Set Up"
3. Choose "Web" platform
4. Enter your website URL: `http://localhost:3000` (for development)
5. Go to Facebook Login > Settings
6. Add OAuth Redirect URI:
   ```
   http://localhost:3000/auth/facebook/callback
   ```
7. Save changes

### Step 3: Get App Credentials
1. Go to Settings > Basic
2. Copy the App ID and App Secret
3. Note: You may need to complete additional verification steps if requested by Facebook

### Step 4: Configure Permissions
1. Go to App Review > Permissions and Features
2. Add the following permissions:
   - `email`
   - `public_profile`
3. Provide necessary documentation for review if required

## Apple Sign-in Setup

### Step 1: Enroll in Apple Developer Program
1. Go to [Apple Developer Program](https://developer.apple.com/programs/)
2. Complete enrollment if not already enrolled
   - Requires annual fee ($99/year)
   - Organization verification may be required

### Step 2: Configure Sign in with Apple
1. Go to [Apple Developer Portal](https://developer.apple.com)
2. Navigate to Certificates, Identifiers & Profiles
3. Go to Identifiers
4. Click the "+" button to register a new identifier
5. Select "Services ID"
6. Configure the service:
   - Description: "FaithFlow Web"
   - Identifier: com.faithflow.web
7. Check "Sign In with Apple"
8. Click "Configure"

### Step 3: Configure Domains and Redirect URIs
1. Add your domain:
   ```
   localhost
   ```
2. Add your return URL:
   ```
   http://localhost:3000/auth/apple/callback
   ```
3. Click "Next" and "Done"
4. Download the verification file for your domain

### Step 4: Create Private Key
1. Go to Keys in the Developer Portal
2. Click the "+" button to add a new key
3. Name: "FaithFlow Sign In with Apple Key"
4. Check "Sign In with Apple"
5. Configure the key:
   - Select your Primary App ID
   - Save the key
6. Download the key file (you only get one chance)
7. Note the Key ID

## Environment Variables

Add these credentials to your `.env` file:

```env
# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:3001/auth/google/callback"

# Facebook OAuth
FACEBOOK_APP_ID="your-facebook-app-id"
FACEBOOK_APP_SECRET="your-facebook-app-secret"
FACEBOOK_REDIRECT_URI="http://localhost:3000/auth/facebook/callback"

# Apple Sign In
APPLE_SERVICE_ID="your-apple-service-id"
APPLE_TEAM_ID="your-apple-team-id"
APPLE_KEY_ID="your-apple-key-id"
APPLE_PRIVATE_KEY="your-apple-private-key"
APPLE_REDIRECT_URI="http://localhost:3000/auth/apple/callback"
```

## Testing Your Setup

### Test Google Sign-In
1. Start your application
2. Click "Continue with Google"
3. Select a Google account
4. Verify that you're redirected back and logged in

### Test Facebook Sign-In
1. Start your application
2. Click "Continue with Facebook"
3. Enter Facebook credentials
4. Accept the permissions
5. Verify successful login

### Test Apple Sign-In
1. Start your application
2. Click "Continue with Apple"
3. Sign in with Apple ID
4. Choose account sharing options
5. Verify successful login

## Production Considerations

Before deploying to production:

1. Update all redirect URIs to use your production domain
2. Add production URLs to authorized domains in each provider's console
3. Complete any required verification processes
4. Ensure proper error handling for failed authentication
5. Implement proper security measures for storing tokens
6. Consider implementing refresh token rotation
7. Set up proper logging for authentication events
8. Configure rate limiting for auth endpoints

## Security Best Practices

1. Always use HTTPS in production
2. Store client secrets securely
3. Implement CSRF protection
4. Use state parameters for OAuth flows
5. Validate all tokens on the server side
6. Implement proper session management
7. Regular security audits
8. Monitor for suspicious activities

## Troubleshooting

### Common Issues

1. **Redirect URI Mismatch**
   - Double-check URIs exactly match in both app settings and code
   - Include protocol (http/https) and remove trailing slashes

2. **Invalid Client Error**
   - Verify client ID and secret are correct
   - Check if credentials are for correct environment

3. **Scope Related Issues**
   - Ensure all required scopes are properly configured
   - Check if scopes match between request and configuration

4. **SSL/HTTPS Issues**
   - Ensure proper SSL setup in production
   - Local development might need specific configuration

### Getting Help

- Google OAuth: [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- Facebook Login: [Facebook Login Documentation](https://developers.facebook.com/docs/facebook-login/)
- Sign in with Apple: [Sign in with Apple Documentation](https://developer.apple.com/sign-in-with-apple/)
