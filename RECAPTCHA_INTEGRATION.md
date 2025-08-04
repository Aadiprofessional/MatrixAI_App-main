# reCAPTCHA v2 Integration

This document describes the reCAPTCHA v2 integration implemented in the MatrixAI application.

## Overview

reCAPTCHA v2 ("I'm not a robot" checkbox with image challenge) has been integrated into the login and signup flows to verify users are human before authentication.

## Implementation Details

### Components

- **ReCaptcha Component** (`/components/ReCaptcha.js`): A reusable React Native component that displays Google reCAPTCHA v2 using WebView
- **EmailLoginScreen** (`/screens/EmailLoginScreen.js`): Login screen with reCAPTCHA verification
- **SignUpDetailsScreen** (`/screens/SignUpDetailsScreen.js`): Signup screen with reCAPTCHA verification

### Features

1. **Modal-based reCAPTCHA**: Opens in a modal overlay when verification is required
2. **Theme Support**: Supports both light and dark themes
3. **Visual Feedback**: Shows checkmark icon on buttons when verification is complete
4. **Error Handling**: Handles verification failures, expiration, and network errors
5. **Toast Notifications**: Provides user feedback for verification status

### User Flow

1. User fills in login/signup form
2. User clicks Login/Sign Up button
3. If not verified, reCAPTCHA modal opens
4. User completes reCAPTCHA challenge
5. On success, modal closes and verification icon appears
6. User can now proceed with authentication

### Configuration

- **Site Key**: Using production reCAPTCHA site key (6LfOv5QrAAAAACbPBOG3y_lmTR06Bw8GrUa542Un)
- **Secret Key**: 6LfOv5QrAAAAAFZnEcm7SzUY5kcAKlPDi0UG12p9 (for server-side verification)
- **Theme**: Automatically matches app theme (light/dark)
- **Size**: Standard reCAPTCHA size

### Security Notes

- Uses Google's official reCAPTCHA v2 API with production keys
- Verification token is generated client-side
- Production keys are configured for real verification
- Consider implementing server-side token verification using the secret key for enhanced security

### Dependencies

- `react-native-webview`: For displaying reCAPTCHA in WebView
- `react-native-vector-icons`: For verification checkmark icons
- `react-native-toast-message`: For user notifications

### Testing

- Test site key allows all verifications to pass
- Replace with production keys for real verification
- Test both successful and failed verification scenarios