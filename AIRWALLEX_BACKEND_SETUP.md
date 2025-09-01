# Airwallex Payment Integration Setup Guide

## Overview
This guide covers the complete setup of Airwallex payment integration with both direct API integration and backend fallback support.

## Current Implementation
The payment system now supports:
1. **Direct Airwallex API Integration** - When credentials are configured
2. **Backend API Fallback** - When direct integration is not available
3. **Comprehensive Error Handling** - With user-friendly setup instructions

## Quick Setup

### 1. Configure Environment Variables
Update the `.env` file in your project root:

```bash
# Airwallex Sandbox Credentials
AIRWALLEX_CLIENT_ID=your_actual_client_id_here
AIRWALLEX_API_KEY=your_actual_api_key_here
AIRWALLEX_ENVIRONMENT=sandbox
```

### 2. Obtain Airwallex Credentials

#### Creating Sandbox Account
1. Visit [Airwallex Developer Portal](https://www.airwallex.com/)
2. Sign up for a sandbox account
3. Complete the verification process
4. Navigate to **Account > Developer > API keys**

#### Generating API Credentials
1. In the Airwallex web app, go to **Account > Developer > API keys**
2. Generate your sandbox credentials:
   - **Client ID**: Used for API authentication
   - **API Key**: Secret key for secure API calls
3. Copy these values to your `.env` file

### 3. Install Dependencies
Ensure `react-native-config` is installed:
```bash
npm install react-native-config
```

### 4. Restart Your App
After updating environment variables:
```bash
# Stop the current app
# Restart Metro bundler
npx react-native start --reset-cache

# Rebuild and run the app
npx react-native run-ios  # or run-android
```

## How It Works

### Direct API Integration Flow
1. App checks if Airwallex credentials are configured
2. If available, authenticates directly with Airwallex API
3. Creates payment intent using Airwallex sandbox/production API
4. Presents payment flow using Airwallex React Native SDK

### Backend Fallback Flow
1. If direct credentials are not available, falls back to backend API
2. Backend handles Airwallex authentication and payment intent creation
3. Returns payment intent details to mobile app
4. App proceeds with Airwallex SDK presentation

### Error Handling
- **No Credentials**: Shows setup instructions with links to documentation
- **API Failures**: Provides specific error messages and troubleshooting steps
- **SDK Errors**: Handles authentication and network failures gracefully

## Backend Configuration Required

To fix the authentication issue, the backend server needs:

### 1. Airwallex API Credentials

```javascript
// Backend environment variables needed:
AIRWALLEX_CLIENT_ID=your_client_id_here
AIRWALLEX_API_KEY=your_api_key_here
AIRWALLEX_ENVIRONMENT=demo  // or 'production'
```

### 2. Backend API Endpoint

The endpoint `/api/payment/airwallex/create-intent` should:

1. **Authenticate with Airwallex**:
   ```javascript
   // Get access token from Airwallex
   const tokenResponse = await fetch('https://api-demo.airwallex.com/api/v1/authentication/login', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       'x-client-id': process.env.AIRWALLEX_CLIENT_ID,
       'x-api-key': process.env.AIRWALLEX_API_KEY
     })
   });
   ```

2. **Create Payment Intent**:
   ```javascript
   // Use the access token to create payment intent
   const paymentResponse = await fetch('https://api-demo.airwallex.com/api/v1/pa/payment_intents', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'Authorization': `Bearer ${accessToken}`
     },
     body: JSON.stringify({
       request_id: requestData.request_id,
       amount: requestData.amount,
       currency: requestData.currency,
       merchant_order_id: requestData.merchant_order_id,
       return_url: requestData.return_url
     })
   });
   ```

### 3. Error Handling

The backend should handle common errors:

- **401 Unauthorized**: Invalid credentials
- **403 Forbidden**: Insufficient permissions
- **400 Bad Request**: Invalid request parameters
- **500 Internal Server Error**: Server configuration issues

## Testing Steps

### With Test Mode (Current Setup):

1. ✅ App loads payment screen
2. ✅ Mock payment intent is created
3. ✅ UI flow works correctly
4. ❌ Payment fails at Airwallex SDK level (expected)

### With Backend Fixed:

1. Set `useTestMode = false` in `AirwallexPaymentScreen.js`
2. Ensure backend has proper Airwallex credentials
3. Test payment flow end-to-end

## Airwallex Sandbox Setup

For testing, you need:

1. **Airwallex Sandbox Account**: Create at [airwallex.com](https://airwallex.com) <mcreference link="https://www.airwallex.com/docs/developer-tools__sandbox-environment-overview" index="1">1</mcreference>
   - Click "Get started in sandbox" or use the sandbox account creation link
   - Enter business email, name, business country, and password
   - Account will be ready instantly

2. **API Credentials**: Generate in sandbox web app <mcreference link="https://www.airwallex.com/docs/developer-tools__sandbox-environment-overview" index="1">1</mcreference>
   - Navigate to Account > Developer > API keys
   - Generate sandbox Client ID and API key
   - Use these for obtaining access tokens

3. **Sandbox Environment**: Use demo API endpoints <mcreference link="https://www.airwallex.com/docs/developer-tools__sandbox-environment-overview" index="1">1</mcreference>
   - Sandbox API host: `https://api-demo.airwallex.com/api/v1/`
   - Production API host: `https://api.airwallex.com/api/v1/`

4. **Access Token**: Required for all API calls <mcreference link="https://www.airwallex.com/docs/developer-tools__sandbox-environment-overview" index="1">1</mcreference>
   - Call API access token API with Client ID and API key
   - Include in Authorization: Bearer [token] header

### Test Card Numbers:

```
Visa: 4012 0000 3333 0026
Mastercard: 5200 0000 0000 1096
American Express: 3400 0000 0000 009
```

## Production Deployment

### Security Considerations:

1. **Never expose API keys** in frontend code
2. **Use environment variables** for credentials
3. **Implement proper authentication** for backend endpoints
4. **Use HTTPS** for all API communications
5. **Validate all inputs** on backend

### Environment Configuration:

```javascript
// Production settings
const AIRWALLEX_CONFIG = {
  environment: 'production', // Change from 'demo'
  baseURL: 'https://api.airwallex.com', // Change from demo URL
  clientId: process.env.AIRWALLEX_PROD_CLIENT_ID,
  apiKey: process.env.AIRWALLEX_PROD_API_KEY
};
```

## Troubleshooting

### Common Issues:

1. **"Access denied"**: Check API credentials
2. **"Invalid request"**: Verify request format
3. **"Network error"**: Check backend URL and connectivity
4. **"Timeout"**: Increase request timeout settings

### Debug Steps:

1. Check backend logs for detailed error messages
2. Verify Airwallex credentials in dashboard
3. Test API endpoints directly with Postman
4. Check network connectivity and firewall settings

## Contact Information

For Airwallex support:
- Documentation: [docs.airwallex.com](https://docs.airwallex.com)
- Support: [support.airwallex.com](https://support.airwallex.com)
- API Reference: [api-demo.airwallex.com](https://api-demo.airwallex.com)