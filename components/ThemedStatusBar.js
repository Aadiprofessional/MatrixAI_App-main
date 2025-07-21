import React from 'react';
import { StatusBar } from 'react-native';
import { useTheme } from '../context/ThemeContext';

/**
 * A themed StatusBar component that automatically uses the correct barStyle 
 * based on the current theme (light-content for dark theme, dark-content for light theme)
 */
const ThemedStatusBar = ({ ...props }) => {
  const { statusBarStyle } = useTheme();
  
  return <StatusBar barStyle={statusBarStyle} animated={false} {...props} />;
};

export default ThemedStatusBar; 