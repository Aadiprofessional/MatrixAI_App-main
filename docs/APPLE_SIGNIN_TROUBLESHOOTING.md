# Apple Sign-In Troubleshooting Guide

## Overview
This document provides troubleshooting steps for Apple Sign-In authentication errors in the MatrixAI React Native app.

## Common Error Codes

### Error 1000: Unknown/Configuration Error
**Symptoms:**
- Error message: `com.apple.AuthenticationServices.AuthorizationError error 1000`
- Apple Sign-In popup appears but fails after entering credentials

**Common Causes:**
1. Missing Apple Sign-In capability in Xcode project
2. Missing or incorrect entitlements file
3. Bundle identifier mismatch between app and Apple Developer Console
4. Development team not properly configured
5. Testing on simulator with unsupported iOS version

**Solutions:**
1. **Check Entitlements File:**
   - Ensure `MatrixAI.entitlements` exists in `ios/MatrixAI/` directory
   - Verify it contains the Apple Sign-In entitlement:
   ```xml
   <key>com.apple.developer.applesignin</key>
   <array>
       <string>Default</string>
   </array>
   ```

2. **Verify Xcode Configuration:**
   - Open project in Xcode
   - Go to "Signing & Capabilities" tab
   - Ensure "Sign in with Apple" capability is added
   - Check that entitlements file is referenced in build settings

3. **Apple Developer Console Setup:**
   - Verify App ID has "Sign In with Apple" capability enabled
   - Ensure bundle identifier matches exactly
   - Create and configure Sign In with Apple key if needed

4. **Testing Environment:**
   - Test on real device (iOS 13+)
   - Simulator support is limited and may not work consistently

### Error 1001: User Cancelled
**Symptoms:**
- Error message: `com.apple.AuthenticationServices.AuthorizationError error 1001`
- User cancelled the authentication flow

**Solutions:**
- This is expected behavior when user cancels
- Provide clear UI feedback that sign-in was cancelled
- Allow user to retry authentication

## Implementation Details

### Files Modified
1. **`ios/MatrixAI/MatrixAI.entitlements`** - Added Apple Sign-In entitlement
2. **`ios/MatrixAI.xcodeproj/project.pbxproj`** - Added entitlements file reference and CODE_SIGN_ENTITLEMENTS setting
3. **`screens/LoginScreens.js`** - Improved error handling for Apple authentication errors
4. **`screens/EmailLoginScreen.js`** - Improved error handling for Apple authentication errors

### Error Handling Improvements
The app now provides specific error messages for different Apple Sign-In error codes:
- Error 1000: "Apple Sign-In configuration error. Please try again or contact support if the issue persists."
- Error 1001: "Apple Sign-In was cancelled. Please try again."

## Testing Checklist

### Before Testing
- [ ] Entitlements file exists and contains Apple Sign-In capability
- [ ] Xcode project references entitlements file
- [ ] Bundle identifier matches Apple Developer Console
- [ ] Development team is properly configured
- [ ] Testing on real device with iOS 13+

### During Testing
- [ ] Apple Sign-In button appears
- [ ] Tapping button shows Apple authentication popup
- [ ] Successful authentication redirects to app
- [ ] Error handling shows appropriate messages
- [ ] User cancellation is handled gracefully

## Additional Resources

- [Apple Sign-In Documentation](https://developer.apple.com/documentation/authenticationservices)
- [React Native Apple Authentication](https://github.com/invertase/react-native-apple-authentication)
- [Supabase Apple Sign-In Guide](https://supabase.com/docs/guides/auth/social-login/auth-apple)

## Support

If issues persist after following this guide:
1. Check Apple Developer Console for any configuration issues
2. Verify all certificates and provisioning profiles are up to date
3. Test with a fresh app build
4. Contact development team with specific error logs