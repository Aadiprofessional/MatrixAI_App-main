#!/bin/bash

echo "🔧 Fixing iOS build issues for MatrixAI..."

# Navigate to iOS directory
cd "$(dirname "$0")"

echo "📁 Current directory: $(pwd)"

# 1. Clean all build artifacts
echo "🧹 Cleaning build artifacts..."
rm -rf build/
rm -rf Pods/
rm -rf Podfile.lock
rm -rf ~/Library/Developer/Xcode/DerivedData/MatrixAI-*
rm -rf ~/Library/Caches/CocoaPods

# 2. Clean React Native cache
echo "🧹 Cleaning React Native cache..."
cd ..
npx react-native start --reset-cache --port 8081 &
METRO_PID=$!
sleep 3
kill $METRO_PID 2>/dev/null || true

# 3. Clean npm/yarn cache
echo "🧹 Cleaning npm cache..."
npm cache clean --force

# 4. Reinstall node modules
echo "📦 Reinstalling node modules..."
rm -rf node_modules
npm install

# 5. Go back to iOS and reinstall pods
echo "📦 Reinstalling CocoaPods..."
cd ios
pod deintegrate
pod cache clean --all
pod install --repo-update

# 6. Fix common Xcode issues
echo "🔧 Applying Xcode fixes..."

# Create a temporary script to fix Xcode project settings
cat > fix_xcode_settings.rb << 'EOF'
require 'xcodeproj'

project_path = 'MatrixAI.xcodeproj'
project = Xcodeproj::Project.open(project_path)

project.targets.each do |target|
  target.build_configurations.each do |config|
    # Fix Swift compilation issues
    config.build_settings['SWIFT_VERSION'] = '5.0'
    config.build_settings['ENABLE_BITCODE'] = 'NO'
    config.build_settings['ONLY_ACTIVE_ARCH'] = config.name == 'Debug' ? 'YES' : 'NO'
    
    # Fix build database issues
    config.build_settings['CLANG_ENABLE_MODULES'] = 'YES'
    config.build_settings['CLANG_ENABLE_OBJC_ARC'] = 'YES'
    
    # Fix React Native specific issues
    config.build_settings['DEAD_CODE_STRIPPING'] = 'NO'
    config.build_settings['LIBRARY_SEARCH_PATHS'] ||= ['$(inherited)']
    config.build_settings['LIBRARY_SEARCH_PATHS'] << '"$(TOOLCHAIN_DIR)/usr/lib/swift/$(PLATFORM_NAME)"'
    
    # Fix for iOS 17+ compatibility
    config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '13.0'
    
    # Fix header search paths
    config.build_settings['HEADER_SEARCH_PATHS'] ||= ['$(inherited)']
    config.build_settings['HEADER_SEARCH_PATHS'] << '"$(BUILT_PRODUCTS_DIR)/usr/local/lib/include"'
    config.build_settings['HEADER_SEARCH_PATHS'] << '"$(BUILT_PRODUCTS_DIR)/usr/local/lib/Headers"'
    
    # Fix framework search paths
    config.build_settings['FRAMEWORK_SEARCH_PATHS'] ||= ['$(inherited)']
    config.build_settings['FRAMEWORK_SEARCH_PATHS'] << '"$(BUILT_PRODUCTS_DIR)"'
  end
end

project.save

puts "✅ Xcode project settings fixed!"
EOF

# Run the Ruby script if xcodeproj gem is available
if gem list xcodeproj -i > /dev/null 2>&1; then
  ruby fix_xcode_settings.rb
  rm fix_xcode_settings.rb
else
  echo "⚠️  xcodeproj gem not found. Skipping Xcode project fixes."
  echo "   You can install it with: gem install xcodeproj"
  rm fix_xcode_settings.rb
fi

echo "✅ iOS build fixes completed!"
echo ""
echo "🚀 Next steps:"
echo "1. Open MatrixAI.xcworkspace (not .xcodeproj) in Xcode"
echo "2. Select your development team in Signing & Capabilities"
echo "3. Clean Build Folder (Cmd+Shift+K)"
echo "4. Try archiving again (Product > Archive)"
echo ""
echo "If you still have issues, try:"
echo "- Restart Xcode completely"
echo "- Restart your Mac"
echo "- Check that your Apple Developer account is active"