/**
 * Google OAuth Configuration Check
 * 
 * This script helps verify your Google OAuth configuration to ensure
 * it works correctly with Supabase authentication.
 * 
 * How to use:
 * 1. Make sure you have Node.js installed
 * 2. Run this script with: node scripts/google-oauth-check.js
 * 3. Follow the instructions and fix any issues identified
 */

const https = require('https');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Constants for your project - using environment variable if available
const dotenv = require('dotenv');
dotenv.config();

const SUPABASE_PROJECT_ID = process.env.SUPABASE_PROJECT_ID || 'ddtgdhehxhgarkonvpfq';
const REDIRECT_URI = `https://${SUPABASE_PROJECT_ID}.supabase.co/auth/v1/callback`;
const PROJECT_URL_SCHEME = 'matrixai';

console.log('\n=== Google OAuth Configuration Check ===\n');
console.log('This script will help you verify your Google OAuth setup for Supabase integration.\n');

// Check if proper redirect URI is configured
console.log('Your Supabase redirect URI should be:');
console.log(`  ${REDIRECT_URI}`);
console.log('\nThis URI must be added to your Google Cloud Console project as an authorized redirect URI.');

// Display validation steps
console.log('\n=== Steps to Fix "redirect_uri_mismatch" Error ===\n');
console.log('1. Go to Google Cloud Console (https://console.cloud.google.com/)');
console.log('2. Select your project');
console.log('3. Navigate to "APIs & Services" > "Credentials"');
console.log('4. Find your OAuth 2.0 Client ID');
console.log('5. Add EXACTLY this URI to "Authorized redirect URIs":');
console.log(`   ${REDIRECT_URI}`);
console.log('6. Make sure there are no trailing slashes or typos');
console.log('7. Save your changes');

// Validation check
function validateRedirectUri(uri) {
  const issues = [];
  
  // Check for scheme
  if (!uri.startsWith('https://') && !uri.startsWith(`${PROJECT_URL_SCHEME}://`)) {
    issues.push('URI should start with https:// for web redirects');
  }
  
  // Check for trailing slashes
  if (uri.endsWith('/') && !uri.endsWith('callback/')) {
    issues.push('URI has a trailing slash that might cause mismatch');
  }
  
  // Check for Supabase project ID
  if (uri.includes('supabase.co') && !uri.includes(`${SUPABASE_PROJECT_ID}.supabase.co`)) {
    issues.push('Possible typo in Supabase project ID');
  }
  
  return issues;
}

// Ask for input
console.log('\n=== Verification ===\n');
rl.question('Would you like me to check if your redirect URI is accessible? (y/n): ', (answer) => {
  if (answer.toLowerCase() === 'y') {
    console.log(`\nChecking accessibility of ${REDIRECT_URI}...`);
    
    https.get(REDIRECT_URI, (res) => {
      console.log(`Response status code: ${res.statusCode}`);
      
      if (res.statusCode === 200) {
        console.log('✅ Redirect URI is accessible!');
      } else {
        console.log('⚠️ Redirect URI returned non-200 status code.');
        console.log('This might be normal for auth endpoints, but verify the URL is correct.');
      }
      
      finishCheck();
    }).on('error', (err) => {
      console.log('❌ Error accessing redirect URI:', err.message);
      console.log('Please verify the URI is correct and accessible.');
      finishCheck();
    });
  } else {
    finishCheck();
  }
});

function finishCheck() {
  console.log('\n=== Final Configuration Checklist ===\n');
  console.log('Make sure you have completed these steps:');
  console.log('☐ Added the exact redirect URI to Google Cloud Console');
  console.log('☐ Configured the correct client ID in your app code');
  console.log('☐ Configured the correct client secret in Supabase Auth settings');
  console.log('☐ Enabled the Google Sign-In API in Google Cloud Console');
  console.log('☐ Restarted your app after making configuration changes');
  console.log('\nIf you continue to face issues, consider:');
  console.log('• Clearing Safari cache');
  console.log('• Testing on a real device (not a simulator)');
  console.log('• Checking console logs for specific error messages');
  
  console.log('\nGood luck with your Google authentication!\n');
  rl.close();
}
