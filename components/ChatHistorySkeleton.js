import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import * as Animatable from 'react-native-animatable';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../context/ThemeContext';

const ChatHistorySkeleton = ({ count = 3 }) => {
  const { currentTheme } = useTheme();

  const renderSkeletonItem = (index) => (
    <Animatable.View 
      key={`chat-skeleton-${index}`}
      animation="pulse"
      iterationCount="infinite"
      duration={1500}
      style={[
        styles.chatHistoryItem,
        {
          backgroundColor: currentTheme === 'dark' 
            ? 'rgba(40, 40, 50, 0.6)' 
            : 'rgba(255, 255, 255, 0.8)',
          borderColor: currentTheme === 'dark' 
            ? 'rgba(60, 60, 70, 0.3)' 
            : 'rgba(220, 220, 220, 0.3)',
        }
      ]}
    >
      <Animatable.View
        animation="slideInRight"
        iterationCount="infinite"
        duration={2000}
        style={styles.shimmerContainer}
      >
        <LinearGradient
          colors={currentTheme === 'dark' 
            ? ['rgba(60, 60, 70, 0.3)', 'rgba(80, 80, 90, 0.6)', 'rgba(60, 60, 70, 0.3)']
            : ['rgba(240, 240, 240, 0.3)', 'rgba(220, 220, 220, 0.6)', 'rgba(240, 240, 240, 0.3)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.shimmerGradient}
        />
      </Animatable.View>
      
      <View style={styles.chatItemContent}>
        {/* Chat title skeleton */}
        <View style={[
          styles.skeletonLine,
          styles.titleLine,
          {
            backgroundColor: currentTheme === 'dark' 
              ? 'rgba(100, 100, 110, 0.4)' 
              : 'rgba(200, 200, 200, 0.4)',
          }
        ]} />
        
        {/* Chat preview skeleton */}
        <View style={[
          styles.skeletonLine,
          styles.previewLine,
          {
            backgroundColor: currentTheme === 'dark' 
              ? 'rgba(100, 100, 110, 0.4)' 
              : 'rgba(200, 200, 200, 0.4)',
          }
        ]} />
        
        {/* Timestamp skeleton */}
        <View style={[
          styles.skeletonLine,
          styles.timestampLine,
          {
            backgroundColor: currentTheme === 'dark' 
              ? 'rgba(100, 100, 110, 0.4)' 
              : 'rgba(200, 200, 200, 0.4)',
          }
        ]} />
      </View>
      
      {/* Chat options skeleton */}
      <View style={[
        styles.optionsContainer,
        {
          backgroundColor: currentTheme === 'dark' 
            ? 'rgba(100, 100, 110, 0.4)' 
            : 'rgba(200, 200, 200, 0.4)',
        }
      ]} />
    </Animatable.View>
  );

  return (
    <View style={styles.container}>
      {Array(count).fill(0).map((_, index) => renderSkeletonItem(index))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  chatHistoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  shimmerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
  },
  shimmerGradient: {
    flex: 1,
    borderRadius: 12,
  },
  chatItemContent: {
    flex: 1,
    paddingRight: 12,
  },
  skeletonLine: {
    borderRadius: 4,
    marginVertical: 2,
  },
  titleLine: {
    height: 16,
    width: '80%',
    marginBottom: 6,
  },
  previewLine: {
    height: 14,
    width: '100%',
    marginBottom: 4,
  },
  timestampLine: {
    height: 12,
    width: '40%',
  },
  optionsContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
});

export default ChatHistorySkeleton;