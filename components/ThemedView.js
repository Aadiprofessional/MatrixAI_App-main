import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

// ThemedView component that applies theme colors to View
export const ThemedView = ({ style, children, ...props }) => {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  
  return (
    <View 
      style={[{ backgroundColor: colors.background }, style]} 
      {...props}
    >
      {children}
    </View>
  );
};

// ThemedText component that applies theme colors to Text
export const ThemedText = ({ style, children, ...props }) => {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  
  return (
    <Text 
      style={[{ color: colors.text }, style]} 
      {...props}
    >
      {children}
    </Text>
  );
};

// ThemedCard component for card-like UI elements
export const ThemedCard = ({ style, children, ...props }) => {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  
  return (
    <View 
      style={[
        styles.card, 
        { 
          backgroundColor: colors.card,
          borderColor: colors.border
        }, 
        style
      ]} 
      {...props}
    >
      {children}
    </View>
  );
};

// ThemedButton component for buttons
export const ThemedButton = ({ style, textStyle, title, onPress, children, ...props }) => {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  
  return (
    <View 
      style={[
        styles.button, 
        { 
          backgroundColor: colors.primary,
        }, 
        style
      ]} 
      {...props}
    >
      <Text 
        style={[
          styles.buttonText, 
          { color: '#ffffff' }, 
          textStyle
        ]}
        onPress={onPress}
      >
        {title || children}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  }
});

export default ThemedView; 