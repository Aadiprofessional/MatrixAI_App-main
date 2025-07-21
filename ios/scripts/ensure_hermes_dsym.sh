#!/bin/bash

# Log the start of the script
echo "Running ensure_hermes_dsym.sh script to fix Hermes dSYM generation..."

# Make sure DEBUG_INFORMATION_FORMAT is set to dwarf-with-dsym for hermes
HERMES_FRAMEWORK="${BUILT_PRODUCTS_DIR}/hermes.framework"

if [ -d "$HERMES_FRAMEWORK" ]; then
  echo "Found Hermes framework at: $HERMES_FRAMEWORK"
  
  # Generate dSYM file for hermes
  echo "Generating dSYM for Hermes framework..."
  xcrun dsymutil "$HERMES_FRAMEWORK/hermes"
  
  # Verify the dSYM was created
  HERMES_DSYM="${HERMES_FRAMEWORK}.dSYM"
  if [ -d "$HERMES_DSYM" ]; then
    echo "Successfully generated Hermes dSYM at: $HERMES_DSYM"
    
    # Check the UUID
    BINARY_UUID=$(xcrun dwarfdump --uuid "$HERMES_FRAMEWORK/hermes" | awk '{print $2}')
    DSYM_UUID=$(xcrun dwarfdump --uuid "$HERMES_DSYM/Contents/Resources/DWARF/hermes" | awk '{print $2}')
    
    echo "Binary UUID: $BINARY_UUID"
    echo "dSYM UUID: $DSYM_UUID"
    
    if [ "$BINARY_UUID" != "$DSYM_UUID" ]; then
      echo "WARNING: UUIDs do not match. Regenerating dSYM..."
      rm -rf "$HERMES_DSYM"
      xcrun dsymutil "$HERMES_FRAMEWORK/hermes"
    else
      echo "UUIDs match. dSYM is valid."
    fi
  else
    echo "Failed to generate Hermes dSYM"
  fi
else
  echo "Hermes framework not found at: $HERMES_FRAMEWORK"
fi

echo "Ensure Hermes dSYM script completed."
exit 0 