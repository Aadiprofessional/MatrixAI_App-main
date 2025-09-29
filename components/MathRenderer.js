import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import MathJaxSvg from 'react-native-mathjax-svg';

const MathRenderer = ({ 
  mathContent, 
  displayMode = false, 
  isDarkMode = false,
  width = 300 
}) => {
  console.log('🎯 MathRenderer received mathContent:', mathContent);
  console.log('🎯 Display mode:', displayMode);

  // Handle invalid or empty content
  if (!mathContent || typeof mathContent !== 'string') {
    console.log('❌ Invalid math content');
    return (
      <View style={styles.container}>
        <Text style={[styles.errorText, { color: isDarkMode ? '#FFFFFF' : '#000000' }]}>
          Invalid math content
        </Text>
      </View>
    );
  }

  // Clean the math content
  const cleanContent = mathContent.trim();
  
  // Set text color based on theme
  const textColor = isDarkMode ? '#FFFFFF' : '#000000';
  
  try {
    return (
      <View style={[
        styles.container,
        displayMode && styles.displayContainer
      ]}>
        <MathJaxSvg
          fontSize={displayMode ? 18 : 16}
          color={textColor}
          fontCache={true}
        >
          {cleanContent}
        </MathJaxSvg>
      </View>
    );
  } catch (error) {
    console.error('❌ Math rendering error:', error);
    return (
      <View style={styles.container}>
        <Text style={[styles.errorText, { color: '#cc0000' }]}>
          Math Error: {error.message}
        </Text>
      </View>
    );
  }
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  displayContainer: {
    alignSelf: 'stretch',
    alignItems: 'center',
    marginVertical: 16,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  mathText: {
    textAlign: 'left',
  },
  displayMath: {
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
});

export default MathRenderer;