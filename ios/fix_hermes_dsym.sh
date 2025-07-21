#!/bin/bash

echo "Fixing Hermes dSYM files for app store submission..."

# Path to your project directory
PROJECT_DIR="$(pwd)"
echo "Project directory: $PROJECT_DIR"

# Find the most recent archive
ARCHIVES_DIR="$HOME/Library/Developer/Xcode/Archives"
LATEST_ARCHIVE=$(find "$ARCHIVES_DIR" -name "*.xcarchive" -type d -print0 | xargs -0 ls -td | head -n 1)

if [ -z "$LATEST_ARCHIVE" ]; then
  echo "No archives found in $ARCHIVES_DIR"
  exit 1
fi

echo "Latest archive found: $LATEST_ARCHIVE"

# Check if hermes.framework exists in the archive
HERMES_FRAMEWORK="$LATEST_ARCHIVE/Products/Applications/MatrixAI.app/Frameworks/hermes.framework"
if [ ! -d "$HERMES_FRAMEWORK" ]; then
  echo "Hermes framework not found in archive: $HERMES_FRAMEWORK"
  exit 1
fi

echo "Found Hermes framework: $HERMES_FRAMEWORK"

# Find the UUID of the hermes binary in the archive
HERMES_BINARY="$HERMES_FRAMEWORK/hermes"
HERMES_UUID=$(xcrun dwarfdump --uuid "$HERMES_BINARY" | awk '{print $2}')

if [ -z "$HERMES_UUID" ]; then
  echo "Could not get UUID from hermes binary"
  exit 1
fi

echo "Hermes binary UUID: $HERMES_UUID"

# Check if dSYM directory exists
DSYM_DIR="$LATEST_ARCHIVE/dSYMs"
if [ ! -d "$DSYM_DIR" ]; then
  echo "dSYM directory not found in archive: $DSYM_DIR"
  mkdir -p "$DSYM_DIR"
  echo "Created dSYM directory"
fi

# Check if hermes.framework.dSYM exists
HERMES_DSYM="$DSYM_DIR/hermes.framework.dSYM"
if [ ! -d "$HERMES_DSYM" ]; then
  echo "Hermes dSYM not found, searching in derived data..."
  
  # Find in DerivedData
  DERIVED_DATA_DIR="$HOME/Library/Developer/Xcode/DerivedData"
  HERMES_DERIVED_DSYM=$(find "$DERIVED_DATA_DIR" -name "hermes.framework.dSYM" -print0 2>/dev/null | xargs -0 ls -td 2>/dev/null | head -n 1)
  
  if [ -z "$HERMES_DERIVED_DSYM" ]; then
    echo "Could not find hermes.framework.dSYM in DerivedData"
    
    # Try to find inside Pods
    PODS_HERMES_DSYM=$(find "$PROJECT_DIR/Pods" -name "hermes.framework.dSYM" -print0 2>/dev/null | xargs -0 ls -td 2>/dev/null | head -n 1)
    
    if [ -z "$PODS_HERMES_DSYM" ]; then
      echo "Could not find hermes.framework.dSYM in Pods directory"
      echo "Generating dSYM file for hermes.framework..."
      
      # Create a temporary directory for the dsym
      TEMP_DIR=$(mktemp -d)
      
      # Use dsymutil to create the dSYM file
      xcrun dsymutil -o "$TEMP_DIR/hermes.framework.dSYM" "$HERMES_BINARY"
      
      if [ -d "$TEMP_DIR/hermes.framework.dSYM" ]; then
        echo "Successfully generated dSYM file"
        cp -R "$TEMP_DIR/hermes.framework.dSYM" "$DSYM_DIR/"
        rm -rf "$TEMP_DIR"
      else
        echo "Failed to generate dSYM file"
        exit 1
      fi
    else
      echo "Found hermes.framework.dSYM in Pods: $PODS_HERMES_DSYM"
      cp -R "$PODS_HERMES_DSYM" "$DSYM_DIR/"
    fi
  else
    echo "Found hermes.framework.dSYM in DerivedData: $HERMES_DERIVED_DSYM"
    cp -R "$HERMES_DERIVED_DSYM" "$DSYM_DIR/"
  fi
fi

echo "Hermes dSYM path: $HERMES_DSYM"

# Verify UUID matches
if [ -f "$HERMES_DSYM/Contents/Resources/DWARF/hermes" ]; then
  DSYM_UUID=$(xcrun dwarfdump --uuid "$HERMES_DSYM/Contents/Resources/DWARF/hermes" | awk '{print $2}')
  echo "Hermes dSYM UUID: $DSYM_UUID"

  if [ "$HERMES_UUID" != "$DSYM_UUID" ]; then
    echo "WARNING: UUIDs do not match between the binary and dSYM!"
    echo "This may cause App Store submission to fail."
    echo "Binary UUID: $HERMES_UUID"
    echo "dSYM UUID: $DSYM_UUID"
    
    echo "Attempting to fix UUID mismatch..."
    # Use dsymutil again on the binary to ensure matching UUID
    xcrun dsymutil -o "$DSYM_DIR/hermes.framework.dSYM.new" "$HERMES_BINARY"
    if [ -d "$DSYM_DIR/hermes.framework.dSYM.new" ]; then
      rm -rf "$HERMES_DSYM"
      mv "$DSYM_DIR/hermes.framework.dSYM.new" "$HERMES_DSYM"
      echo "Regenerated dSYM with matching UUID"
    fi
  else
    echo "UUID verification successful. dSYM should be valid for submission."
  fi
else
  echo "WARNING: DWARF file not found in dSYM bundle."
  echo "Regenerating dSYM file..."
  xcrun dsymutil -o "$DSYM_DIR/hermes.framework.dSYM.new" "$HERMES_BINARY"
  if [ -d "$DSYM_DIR/hermes.framework.dSYM.new" ]; then
    rm -rf "$HERMES_DSYM"
    mv "$DSYM_DIR/hermes.framework.dSYM.new" "$HERMES_DSYM"
    echo "Regenerated dSYM file"
  fi
fi

echo "Script completed." 