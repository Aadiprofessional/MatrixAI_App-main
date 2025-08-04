import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';

const AnimatedGradientText = ({ text }) => {
  const animation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(animation, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

 

  return (
    <MaskedView
      maskElement={
        <View style={styles.center}>
          <Text style={styles.text}> {text} </Text>
        </View>
      }
    >
      
        <LinearGradient
          colors={['#ff5f6d', '#ffc371', '#00c9ff', '#92fe9d']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        />
    
    </MaskedView>
  );
};

const styles = StyleSheet.create({
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 18,
    fontWeight: 'bold',
    backgroundColor: 'transparent',
    color: 'black', // Needed only to define the shape
  },
  gradient: {
    width: 400, // Make this wider than your text to allow movement
    height: 50,
  },
});

export default AnimatedGradientText;
