import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  StatusBar,
  Animated,
  Text,
  Image,
} from 'react-native';
import Video from 'react-native-video';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';

const { width, height } = Dimensions.get('window');

const StoriesScreen = ({ navigation }) => {
  const videos = [
    {
      id: '1',
      url: 'https://www.w3schools.com/html/mov_bbb.mp4',
      duration: 10000,
      user: {
        name: 'johndoe',
        avatar: 'https://i.pravatar.cc/100?img=1',
      },
    },
    {
      id: '2',
      url: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
      duration: 12000,
      user: {
        name: 'janedoe',
        avatar: 'https://i.pravatar.cc/100?img=2',
      },
    },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const videoRef = useRef(null);

  useEffect(() => {
    startProgressAnimation();
  }, [currentIndex]);

  const startProgressAnimation = () => {
    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: videos[currentIndex].duration,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) goToNextStory();
    });
  };

  const goToNextStory = () => {
    if (currentIndex < videos.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      navigation.goBack();
    }
  };

  const goToPrevStory = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleVideoError = (error) => {
    console.error('Video error:', error);
    goToNextStory();
  };

  const handleScreenPress = (event) => {
    const pressX = event.nativeEvent.locationX;
    if (pressX < width * 0.3) {
      goToPrevStory();
    } else if (pressX > width * 0.7) {
      goToNextStory();
    } else {
      setPaused((prev) => !prev);
    }
  };

  const renderProgressBars = () => (
    <View style={styles.progressContainer}>
      {videos.map((_, index) => {
        const isActive = index === currentIndex;
        return (
          <View key={index} style={styles.progressBarWrapper}>
            {isActive ? (
              <Animated.View
                style={[
                  styles.progressBar,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                    backgroundColor: 'white',
                  },
                ]}
              />
            ) : (
              <View
                style={[
                  styles.progressBar,
                  {
                    width: index < currentIndex ? '100%' : '0%',
                    backgroundColor: index < currentIndex ? 'white' : 'rgba(255,255,255,0.2)',
                  },
                ]}
              />
            )}
          </View>
        );
      })}
    </View>
  );

  const currentUser = videos[currentIndex].user;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar hidden />
      <TouchableOpacity style={styles.videoTouch} activeOpacity={1} onPress={handleScreenPress}>
        <Video
          ref={videoRef}
          source={{ uri: videos[currentIndex].url }}
          style={styles.video}
          resizeMode="cover"
          paused={paused}
          onError={handleVideoError}
        />

        {/* Top Overlay */}
        <LinearGradient
          colors={['rgba(0,0,0,0.5)', 'transparent']}
          style={styles.topOverlay}
        >
          {renderProgressBars()}

          <View style={styles.header}>
            {/* Back button */}
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={26} color="white" />
            </TouchableOpacity>

            {/* Avatar and name */}
            <View style={styles.userInfo}>
              <Image source={{ uri: currentUser.avatar }} style={styles.avatar} />
              <Text style={styles.username}>{currentUser.name}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Pause Icon */}
        {paused && (
          <Ionicons
            name="pause-circle"
            size={64}
            color="white"
            style={styles.pauseIcon}
          />
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  videoTouch: {
    flex: 1,
  },
  video: {
    width,
    height,
    position: 'absolute',
  },
  progressContainer: {
    flexDirection: 'row',
    marginTop: 10,
    paddingHorizontal: 10,
  },
  progressBarWrapper: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: 'white',
  },
  topOverlay: {
    position: 'absolute',
    width: '100%',
    paddingTop: 20,
    paddingBottom: 60,
  },
  header: {
    marginTop: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  backButton: {
    padding: 4,
    marginRight: 10,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    borderColor: 'white',
    borderWidth: 1,
  },
  username: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  pauseIcon: {
    alignSelf: 'center',
    marginTop: height * 0.35,
    opacity: 0.8,
  },
});

export default StoriesScreen;
