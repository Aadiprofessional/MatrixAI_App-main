# Airwallex Sandbox Setup Guide

## Prerequisites

To test the Airwallex payment integration, you need to set up a sandbox environment.

## Step 1: Create Sandbox Account

1. Visit the [Airwallex Sandbox Account Creation](https://www.airwallex.com/app/account/signup?env=demo) page
2. Enter your business email, name, business country, and password
3. Click "Create sandbox account"
4. Your sandbox account will be ready instantly

## Step 2: Generate API Keys

1. Log into the [Airwallex Sandbox Web App](https://demo.airwallex.com/)
2. Navigate to **Account > Developer > API keys**
3. Generate your sandbox API keys:
   - Client ID
   - API Key
4. Save these credentials securely

## Step 3: Get Access Token

Make a POST request to obtain an access token:

```bash
curl -X POST https://api-demo.airwallex.com/api/v1/authentication/login \
  -H "Content-Type: application/json" \
  -H "x-client-id: YOUR_CLIENT_ID" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{}'
```

## Step 4: Create Payment Intent

Use the access token to create a payment intent:

```bash
curl -X POST https://api-demo.airwallex.com/api/v1/pa/payment_intents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "request_id": "unique-request-id",
    "amount": 100,
    "currency": "USD",
    "merchant_order_id": "test-order-123",
    "order": {
      "type": "physical_goods"
    }
  }'
```

## Step 5: Use in React Native App

The response will include:
- `id`: Payment Intent ID
- `client_secret`: Client Secret for the payment

Use these values in your React Native app:

```javascript
const paymentIntentId = "int_hkdmr7v9rg1j58ky8re"; // From API response
const clientSecret = "int_hkdmr7v9rg1j58ky8re_secret_..."; // From API response

AirwallexNative.presentEntirePaymentFlow(
  clientSecret,
  paymentIntentId,
  100, // amount in cents
  'USD'
);
```

## Test Card Numbers

For testing, use these test card numbers:
- **Visa**: 4012000033330026
- **Mastercard**: 5555555555554444
- **Amex**: 378282246310005
- **CVV**: Any 3-4 digits
- **Expiry**: Any future date

## Important Notes

1. **Sandbox Environment**: All transactions are simulated - no real money is processed
2. **API Host**: Use `https://api-demo.airwallex.com/api/v1/` for sandbox
3. **Wallet Funding**: Your sandbox wallet is automatically credited with test funds
4. **Production Switch**: When ready for production, update to `https://api.airwallex.com/api/v1/`

## Troubleshooting

- Ensure you're using sandbox credentials, not production ones
- Verify the payment intent is created successfully before using in the app
- Check that the client secret and payment intent ID match
- Monitor the React Native logs for detailed error messages