import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, useWindowDimensions, Animated } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../context/ThemeContext';

const FeatureCard = ({ title, description, iconSource, navigation, targetScreen }) => {
  const rotation = useRef(new Animated.Value(0)).current;
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  const { width } = useWindowDimensions(); // More responsive to orientation changes

  useEffect(() => {
    // Start the rotation animation
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 6000,
        useNativeDriver: true,
      })
    ).start();
  }, [rotation]);

  // Interpolate the rotation value into a rotation degree
  const rotateInterpolate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Calculate card size to be responsive and square
  // Subtract total horizontal padding/margin and divide by 2 for two cards per row
  const cardSize = (width - 60) / 2; 

  return (
    <TouchableOpacity
      style={[styles.card, { width: cardSize, height: cardSize }]}
      onPress={() => navigation.navigate(targetScreen)} // Navigate to the target screen
    >
      {/* Animated Gradient Background */}
      <Animated.View
        style={[
          styles.animatedGradientContainer,
          {
            transform: [{ rotate: rotateInterpolate }],
          },
        ]}
      >
        <LinearGradient
          colors={['#D9D3FCFF', colors.primary, '#A5FECB']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.gradientBackground}
        />
      </Animated.View>

      <View style={styles.contentContainer}>
        {/* Circle with icon */}
        <View style={styles.circleContainer}>
          <Image source={iconSource} style={styles.icon} />
        </View>

        {/* Card content */}
        <Text style={styles.cardTitle} numberOfLines={2} ellipsizeMode="tail">{title}</Text>
        <Text style={styles.cardDescription} numberOfLines={3} ellipsizeMode="tail">{description}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5, // For Android shadow
    overflow: 'hidden', // Ensures gradient stays inside card
    marginBottom: 10, // Reduced margin for better spacing
  },
  contentContainer: {
    flex: 1,
    padding: 12,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  animatedGradientContainer: {
    position: 'absolute',
    width: 350, // Diameter of the circle
    height: 350,
    borderRadius: 175, // Half of width/height for circle
    top: -80, // Position above the card content
    left: -40, // Slightly offset to the left
  },
  gradientBackground: {
    flex: 1,
    borderRadius: 175, // Match the container
  },
  circleContainer: {
    width: 40,
    height: 40,
    borderRadius: 20, // Circle shape
    backgroundColor: '#FF6600',
    borderColor: '#FF6600', // Orange color border
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  icon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
    tintColor: '#fff',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'left',
    width: '100%',
    marginTop: -4,
  },
  cardDescription: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'left',
    width: '100%',
    color: '#fff',
    flexShrink: 1,
  },
});

export default FeatureCard;
