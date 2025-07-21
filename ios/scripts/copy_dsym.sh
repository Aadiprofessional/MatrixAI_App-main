#!/bin/sh

# Ensure all dSYM files are copied to the final app bundle
if [ "${CONFIGURATION}" = "Release" ]; then
  echo "Collecting dSYM files..."
  
  # Make sure the destination directory exists
  mkdir -p "${DWARF_DSYM_FOLDER_PATH}"
  
  # Find all dSYMs in the build folder
  find "${BUILD_DIR}" -name "*.dSYM" -print0 | while IFS= read -r -d '' dsym; do
    echo "Processing dSYM: $dsym"
    cp -R "$dsym" "${DWARF_DSYM_FOLDER_PATH}"
  done
  
  # Specifically check for hermes.framework.dSYM
  HERMES_DSYM_PATHS=(
    "${BUILD_DIR}/../../Pods.build/Release-iphoneos/hermes-engine.build/Objects-normal/"*"/hermes.framework.dSYM"
    "${BUILD_DIR}/../../../Pods/hermes-engine/destroot/Library/Frameworks/hermes.framework.dSYM"
    "${PODS_ROOT}/hermes-engine/destroot/Library/Frameworks/hermes.framework.dSYM"
  )
  
  for HERMES_DSYM_PATH in "${HERMES_DSYM_PATHS[@]}"; do
    if [ -d "$HERMES_DSYM_PATH" ]; then
      echo "Found Hermes dSYM at: $HERMES_DSYM_PATH"
      cp -R "$HERMES_DSYM_PATH" "${DWARF_DSYM_FOLDER_PATH}"
      break
    fi
  done
  
  echo "All dSYM files collected."
fi 