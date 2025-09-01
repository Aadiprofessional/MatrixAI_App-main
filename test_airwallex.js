// Test script to verify Airwallex service configuration
// Run this with: node test_airwallex.js

// Load environment variables from .env file
require('dotenv').config();

const Config = {
  AIRWALLEX_CLIENT_ID: process.env.AIRWALLEX_CLIENT_ID || null,
  AIRWALLEX_API_KEY: process.env.AIRWALLEX_API_KEY || null,
  AIRWALLEX_ENVIRONMENT: process.env.AIRWALLEX_ENVIRONMENT || 'sandbox'
};

class TestAirwallexService {
  constructor() {
    this.clientId = Config.AIRWALLEX_CLIENT_ID;
    this.apiKey = Config.AIRWALLEX_API_KEY;
    this.environment = Config.AIRWALLEX_ENVIRONMENT;
    this.sandboxApiHost = 'https://api-demo.airwallex.com/api/v1';
    this.productionApiHost = 'https://api.airwallex.com/api/v1';
  }

  hasValidCredentials() {
    return !!(this.clientId && this.apiKey && 
              this.clientId.trim() !== '' && 
              this.apiKey.trim() !== '');
  }

  getApiHost() {
    return this.environment === 'production' ? this.productionApiHost : this.sandboxApiHost;
  }

  async testAuthentication() {
    if (!this.hasValidCredentials()) {
      console.log('❌ No valid credentials found');
      console.log('Client ID:', this.clientId ? 'Set' : 'Not set');
      console.log('API Key:', this.apiKey ? 'Set' : 'Not set');
      return false;
    }

    console.log('✅ Credentials found');
    console.log('Environment:', this.environment);
    console.log('API Host:', this.getApiHost());
    
    try {
      const response = await fetch(`${this.getApiHost()}/authentication/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': this.clientId,
          'x-api-key': this.apiKey
        }
      });

      if (!response.ok) {
        console.log('❌ Authentication failed');
        console.log('Status:', response.status, response.statusText);
        const text = await response.text();
        console.log('Response:', text.substring(0, 200) + '...');
        return false;
      }

      const data = await response.json();
      
      if (data.token) {
        console.log('✅ Authentication successful');
        console.log('Token received:', data.token.substring(0, 20) + '...');
        return true;
      } else {
        console.log('❌ Authentication failed - no token in response');
        console.log('Response:', data);
        return false;
      }
    } catch (error) {
      console.log('❌ Authentication error:', error.message);
      return false;
    }
  }
}

// Run the test
async function runTest() {
  console.log('🧪 Testing Airwallex Service Configuration\n');
  
  const service = new TestAirwallexService();
  const result = await service.testAuthentication();
  
  console.log('\n' + (result ? '✅ Test PASSED' : '❌ Test FAILED'));
  
  if (!result) {
    console.log('\n📋 Setup Instructions:');
    console.log('1. Update .env file with your Airwallex credentials');
    console.log('2. Ensure AIRWALLEX_CLIENT_ID and AIRWALLEX_API_KEY are set');
    console.log('3. Restart your React Native app');
  }
}

runTest().catch(console.error);