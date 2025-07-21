import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { Animated, Easing } from 'react-native';

import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import StoriesScreen from '../screens/StoriesScreen';
// Import other screens as needed

const Stack = createStackNavigator();

// Custom animation configuration for sliding from left to right
const slideFromLeft = {
  gestureDirection: 'horizontal',
  transitionSpec: {
    open: {
      animation: 'timing',
      config: {
        duration: 300,
        easing: Easing.out(Easing.poly(4)),
        timing: Animated.timing,
      },
    },
    close: {
      animation: 'timing',
      config: {
        duration: 300,
        easing: Easing.out(Easing.poly(4)),
        timing: Animated.timing,
      },
    },
  },
  cardStyleInterpolator: ({ current, layouts }) => {
    return {
      cardStyle: {
        transform: [
          {
            translateX: current.progress.interpolate({
              inputRange: [0, 1],
              outputRange: [-layouts.screen.width, 0],
            }),
          },
        ],
      },
    };
  },
};

const AppNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen 
        name="ProfileScreen" 
        component={ProfileScreen}
        options={() => ({
          ...slideFromLeft,
        })}
      />
      <Stack.Screen 
        name="Stories" 
        component={StoriesScreen}
      />
      {/* Add other screens here */}
    </Stack.Navigator>
  );
};

export default AppNavigator; 