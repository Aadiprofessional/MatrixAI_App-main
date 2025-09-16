import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Animated,
  Modal,
  TouchableWithoutFeedback,
  StatusBar,
  Platform,
} from 'react-native';
import {
  PanGestureHandler,
  GestureHandlerRootView,
  State,
} from 'react-native-gesture-handler';

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');
const BOTTOM_SHEET_MAX_HEIGHT = screenHeight * 0.9;
const BOTTOM_SHEET_MIN_HEIGHT = screenHeight * 0.1;
const DRAG_THRESHOLD = 50;

const BottomSheet = ({
  visible,
  onClose,
  children,
  colors = {},
  snapPoints = [BOTTOM_SHEET_MIN_HEIGHT, BOTTOM_SHEET_MAX_HEIGHT],
  initialSnapIndex = 1,
}) => {
  const translateY = useRef(new Animated.Value(screenHeight)).current;
  const lastGestureY = useRef(0);
  const [currentSnapIndex, setCurrentSnapIndex] = useState(initialSnapIndex);

  useEffect(() => {
    if (visible) {
      // Slide up animation
      Animated.spring(translateY, {
        toValue: screenHeight - snapPoints[currentSnapIndex],
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      // Slide down animation
      Animated.spring(translateY, {
        toValue: screenHeight,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    }
  }, [visible, currentSnapIndex]);

  const handleGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: translateY } }],
    {
      useNativeDriver: false, // Changed to false to allow clamping
      listener: (event) => {
        const { translationY } = event.nativeEvent;
        lastGestureY.current = translationY;
        
        // Clamp the translation to prevent over-scrolling
        const maxSnapPoint = Math.max(...snapPoints);
        const minSnapPoint = Math.min(...snapPoints);
        const currentBasePosition = screenHeight - snapPoints[currentSnapIndex];
        
        // Prevent scrolling above maximum height (negative translation beyond max)
        const maxTranslation = currentBasePosition - (screenHeight - maxSnapPoint);
        // Prevent scrolling below minimum height (positive translation beyond min)
        const minTranslation = currentBasePosition - (screenHeight - minSnapPoint);
        
        const clampedTranslation = Math.max(maxTranslation, Math.min(minTranslation, translationY));
        
        // Apply resistance when trying to go beyond bounds
        let finalTranslation = clampedTranslation;
        if (translationY < maxTranslation) {
          // Add resistance when trying to scroll up beyond max
          const resistance = 0.3;
          finalTranslation = maxTranslation + (translationY - maxTranslation) * resistance;
        } else if (translationY > minTranslation) {
          // Add resistance when trying to scroll down beyond min
          const resistance = 0.5;
          finalTranslation = minTranslation + (translationY - minTranslation) * resistance;
        }
        
        translateY.setValue(currentBasePosition + finalTranslation);
      },
    }
  );

  const handleGestureStateChange = (event) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const { translationY, velocityY } = event.nativeEvent;
      
      // Determine if we should close or snap to a point
      if (translationY > DRAG_THRESHOLD || velocityY > 500) {
        // Close the bottom sheet
        onClose();
      } else {
        // Find the closest snap point based on current position
        const currentPosition = screenHeight - snapPoints[currentSnapIndex] + translationY;
        let closestSnapIndex = currentSnapIndex;
        let minDistance = Infinity;
        
        for (let i = 0; i < snapPoints.length; i++) {
          const snapPosition = screenHeight - snapPoints[i];
          const distance = Math.abs(currentPosition - snapPosition);
          if (distance < minDistance) {
            minDistance = distance;
            closestSnapIndex = i;
          }
        }
        
        setCurrentSnapIndex(closestSnapIndex);
        
        // Animate to the closest snap point
        Animated.spring(translateY, {
          toValue: screenHeight - snapPoints[closestSnapIndex],
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }).start();
      }
    }
  };

  const handleBackdropPress = () => {
    onClose();
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.container}>
        <View style={styles.overlay}>
          {/* Backdrop */}
          <TouchableWithoutFeedback onPress={handleBackdropPress}>
            <View style={styles.backdrop} />
          </TouchableWithoutFeedback>

          {/* Bottom Sheet */}
          <PanGestureHandler
            onGestureEvent={handleGestureEvent}
            onHandlerStateChange={handleGestureStateChange}
          >
            <Animated.View
              style={[
                styles.bottomSheet,
                {
                  backgroundColor: colors.background || '#FFFFFF',
                  transform: [{ translateY }],
                  height: BOTTOM_SHEET_MAX_HEIGHT,
                },
              ]}
            >
              {/* Handle */}
              <View style={styles.handleContainer}>
                <View
                  style={[
                    styles.handle,
                    { backgroundColor: colors.border || '#E0E0E0' },
                  ]}
                />
              </View>

              {/* Content */}
              <View style={styles.content}>
                {children}
              </View>
            </Animated.View>
          </PanGestureHandler>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdrop: {
    flex: 1,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 0,
    paddingBottom: 20, // Ensure content doesn't get cut off at bottom
  },
});

export default BottomSheet;