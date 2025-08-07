#!/bin/bash

# MatrixAI - App Store Upload Script
# This script helps ensure proper upload configuration to prevent build disappearing issues

set -e

echo "🚀 MatrixAI App Store Upload Script"
echo "==================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "ios/MatrixAI.xcworkspace" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

print_status "Starting pre-upload checks..."

# Check for required files
print_status "Checking required configuration files..."

if [ ! -f "ios/MatrixAI/Info.plist" ]; then
    print_error "Info.plist not found"
    exit 1
fi

if [ ! -f "ios/MatrixAI/PrivacyInfo.xcprivacy" ]; then
    print_error "PrivacyInfo.xcprivacy not found"
    exit 1
fi

if [ ! -f "ios/MatrixAI/MatrixAI.entitlements" ]; then
    print_error "MatrixAI.entitlements not found"
    exit 1
fi

print_success "All required files found"

# Check for export compliance declaration
print_status "Checking export compliance declaration..."
if grep -q "ITSAppUsesNonExemptEncryption" ios/MatrixAI/Info.plist; then
    print_success "Export compliance declaration found"
else
    print_error "Export compliance declaration missing in Info.plist"
    exit 1
fi

# Check privacy manifest
print_status "Checking privacy manifest..."
if grep -q "NSPrivacyCollectedDataTypes" ios/MatrixAI/PrivacyInfo.xcprivacy; then
    if grep -q "NSPrivacyCollectedDataTypeEmailAddress" ios/MatrixAI/PrivacyInfo.xcprivacy; then
        print_success "Privacy manifest properly configured"
    else
        print_warning "Privacy manifest may be incomplete"
    fi
else
    print_error "Privacy manifest missing data collection declarations"
    exit 1
fi

# Clean build
print_status "Cleaning previous builds..."
cd ios
xcodebuild clean -workspace MatrixAI.xcworkspace -scheme MatrixAI -quiet
print_success "Build cleaned"

# Clean derived data
print_status "Cleaning derived data..."
rm -rf ~/Library/Developer/Xcode/DerivedData/MatrixAI-*
print_success "Derived data cleaned"

cd ..

# Get current version info
print_status "Reading current version information..."
MARKETING_VERSION=$(grep -A1 "MARKETING_VERSION" ios/MatrixAI.xcodeproj/project.pbxproj | grep -o '[0-9]\+\.[0-9]\+' | head -1)
CURRENT_BUILD=$(grep -A1 "CURRENT_PROJECT_VERSION" ios/MatrixAI.xcodeproj/project.pbxproj | grep -o '[0-9]\+' | head -1)

print_status "Current Marketing Version: $MARKETING_VERSION"
print_status "Current Build Number: $CURRENT_BUILD"

# Suggest incrementing build number
NEW_BUILD=$((CURRENT_BUILD + 1))
print_warning "Consider incrementing build number to: $NEW_BUILD"
print_warning "You can do this in Xcode: Project Settings → General → Build"

echo ""
print_status "Pre-upload checklist completed!"
echo ""
print_warning "IMPORTANT UPLOAD INSTRUCTIONS:"
echo "1. Open Xcode and archive your project"
echo "2. When uploading to App Store Connect:"
echo "   ❌ UNCHECK 'Include bitcode for iOS content'"
echo "   ✅ CHECK 'Upload your app's symbols'"
echo "   ✅ CHECK 'Manage Version and Build Number'"
echo "3. Monitor App Store Connect for 60+ minutes"
echo "4. Check email for any rejection notices"
echo ""
print_success "Ready for upload! Follow the instructions above."

# Optional: Open Xcode workspace
read -p "Would you like to open Xcode workspace now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Opening Xcode workspace..."
    open ios/MatrixAI.xcworkspace
fi

print_success "Script completed successfully!"