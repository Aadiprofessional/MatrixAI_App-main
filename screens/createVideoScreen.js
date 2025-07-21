import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Modal,
  Animated,
  ActivityIndicator,
  Linking,
  Easing,
  StatusBar,
  ScrollView,
  Alert,
  Platform,
  PermissionsAndroid,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { VIDEO_SERVICE_UID } from '@env';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import LinearGradient from 'react-native-linear-gradient';
import * as Animatable from 'react-native-animatable';
import LottieView from "lottie-react-native";
import { useAuthUser } from '../hooks/useAuthUser';
import { useFocusEffect } from '@react-navigation/native';
import Video from 'react-native-video';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import Toast from 'react-native-toast-message';
import { PERMISSIONS, request, RESULTS } from 'react-native-permissions';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import { videoService } from '../services/videoService';

const { width, height } = Dimensions.get("window");

const MAX_PROMPT_LENGTH = 100; // Maximum characters before truncation

const CreateVideoScreen = ({ route, navigation }) => {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  const { t } = useLanguage();
  const { message } = route.params; // Extract text from params
  const [videoUrl, setVideoUrl] = useState(null); // Store the generated video URL
  const [loading, setLoading] = useState(true); // Track loading state
  const [modalVisible, setModalVisible] = useState(false); // Modal visibility state
  const [showSkeleton, setShowSkeleton] = useState(true); // Control skeleton visibility
  const [videoId, setVideoId] = useState(null);
  const [taskStatus, setTaskStatus] = useState('PENDING');
  const [isPlaying, setIsPlaying] = useState(false);
  const [downloadingVideo, setDownloadingVideo] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const { uid } = useAuthUser();  
  
  // Animated values
  const shimmerValue = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const loadingDots = useRef(new Animated.Value(0)).current;
  const videoOpacity = useRef(new Animated.Value(0)).current;
  const videoScale = useRef(new Animated.Value(0.95)).current;

  // Format prompt for display
  const truncatedMessage = message.length > MAX_PROMPT_LENGTH 
    ? `${message.substring(0, MAX_PROMPT_LENGTH)}...` 
    : message;

  // Clear data when screen loses focus and reset when it gains focus
  useFocusEffect(
    React.useCallback(() => {
      // This runs when the screen comes into focus
      // Reset all state variables
      setVideoUrl(null);
      setVideoId(null);
      setModalVisible(false);
      setPlayCount(0);
      setShowSkeleton(true);
      setLoading(true);
      setTaskStatus('PENDING');
      setIsPlaying(false);
      
      // Clear any previous video first
      clearStoredVideo();
      // Start new video generation
      initiateVideoGeneration();
      
      // This runs when the screen goes out of focus
      return () => {
        // Clear state when navigating away
        setVideoUrl(null);
        setVideoId(null);
        setModalVisible(false);
        setPlayCount(0);
        // Clear stored video
        clearStoredVideo();
      };
    }, [message])
  );

  // Function to clear stored video
  const clearStoredVideo = async () => {
    try {
      await AsyncStorage.removeItem("generatedVideo");
    } catch (error) {
      console.error("Error clearing stored video:", error);
    }
  };

  useEffect(() => {
    // Start shimmer animation
    Animated.loop(
      Animated.timing(shimmerValue, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
        easing: Easing.linear,
      })
    ).start();

    // Start pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Start loading dots animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(loadingDots, {
          toValue: 3,
          duration: 1500,
          useNativeDriver: false,
        }),
        Animated.timing(loadingDots, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
      ])
    ).start();
    
    // Clean up when component unmounts
    return () => {
      setVideoUrl(null);
      setVideoId(null);
      setPlayCount(0);
      clearStoredVideo();
    };
  }, [shimmerValue, pulseAnim, loadingDots]);

  // Function to initiate video generation
  const initiateVideoGeneration = async () => {
    try {
      // Clear any previously stored video when generating new one
      await clearStoredVideo();
      
      setLoading(true);
      setShowSkeleton(true);
      setPlayCount(0);
      
      // Reset animation values
      videoOpacity.setValue(0);
      videoScale.setValue(0.95);
      
      // Use a working UID instead of the user's UID
      const workingUid = VIDEO_SERVICE_UID || '0a147ebe-af99-481b-bcaf-ae70c9aeb8d8';
      
      // Make API request to create new video using videoService
      const result = await videoService.createVideo({
        uid: workingUid,
        promptText: message
      });
      
      if (result.videoId) {
        setVideoId(result.videoId);
        setTaskStatus(result.taskStatus);
        
        // Start polling for video status
        startPolling(result.videoId);
      } else {
        setLoading(false);
        setShowSkeleton(false);
        Alert.alert(t('error'), t('failedToInitiateVideoGeneration'));
      }
    } catch (error) {
      console.error("Error initiating video generation:", error);
      setLoading(false);
      setShowSkeleton(false);
      Alert.alert(t('error'), t('somethingWentWrong'));
    }
  };

  // Function to poll video status every 2 seconds
  const startPolling = (videoId) => {
    const pollInterval = setInterval(async () => {
      try {
        // Use a working UID instead of the user's UID
        const workingUid = VIDEO_SERVICE_UID || '0a147ebe-af99-481b-bcaf-ae70c9aeb8d8';
        
        // Use videoService to check video status
        const result = await videoService.getVideoStatus({
          uid: workingUid,
          videoId: videoId
        });
        
        setTaskStatus(result.taskStatus);
        
        if (result.taskStatus === 'SUCCEEDED' && result.videoUrl) {
          // Video is ready
          clearInterval(pollInterval);
          setVideoUrl(result.videoUrl);
          
          // Store video data
          const videoData = {
            url: result.videoUrl,
            prompt: message,
            createdAt: new Date().toISOString()
          };
          await AsyncStorage.setItem("generatedVideo", JSON.stringify(videoData));
          
          // Show skeleton for 1 second before revealing the video
          setTimeout(() => {
            setShowSkeleton(false);
            setLoading(false);
            fadeInVideo();
            // Auto-play the video
            setIsPlaying(true);
          }, 1000);
        } else if (result.taskStatus === 'FAILED') {
          // Video generation failed
          clearInterval(pollInterval);
          setLoading(false);
          setShowSkeleton(false);
          Alert.alert(t('error'), t('videoGenerationFailed'));
        }
        // Continue polling if status is still PENDING or PROCESSING
      } catch (error) {
        console.error("Error checking video status:", error);
        clearInterval(pollInterval);
        setLoading(false);
        setShowSkeleton(false);
        Alert.alert(t('error'), t('failedToCheckVideoStatus'));
      }
    }, 2000); // Poll every 2 seconds

    // Clear interval after 5 minutes to prevent infinite polling
    setTimeout(() => {
      clearInterval(pollInterval);
      if (loading) {
        setLoading(false);
        setShowSkeleton(false);
        Alert.alert(t('timeout'), t('videoGenerationTimeout'));
      }
    }, 300000); // 5 minutes timeout
  };

  const fadeInVideo = () => {
    Animated.parallel([
      Animated.timing(videoOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(videoScale, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleTryAgain = () => {
    setVideoUrl(null);
    setVideoId(null);
    setPlayCount(0);
    // Reset animations
    videoOpacity.setValue(0);
    videoScale.setValue(0.95);
    // Fetch new video
    initiateVideoGeneration();
  };

  const openVideoModal = () => {
    if (videoUrl) {
      setModalVisible(true);
    }
  };

  const handleVideoEnd = () => {
    setPlayCount(prev => {
      const newCount = prev + 1;
      if (newCount < 3) {
        // Continue playing for up to 3 times
        setIsPlaying(true);
        return newCount;
      } else {
        // Stop after 3 plays
        setIsPlaying(false);
        return newCount;
      }
    });
  };

  const handleDownloadVideo = async () => {
    if (!videoUrl) return;
    
    try {
      setDownloadingVideo(true);
      
      console.log('Starting video download for URL:', videoUrl);
      
      // Request storage permission (for Android)
      if (Platform.OS === 'android') {
        const permission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Storage Permission',
            message: 'Matrix AI needs access to your storage to save videos.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        
        if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
          Toast.show({
            type: 'error',
            text1: 'Permission Denied',
            text2: 'Cannot save video without storage permission',
            position: 'bottom',
          });
          setDownloadingVideo(false);
          return;
        }
      } else if (Platform.OS === 'ios') {
        // For iOS, request photo library permission (same as image download)
        const permission = await request(PERMISSIONS.IOS.PHOTO_LIBRARY);
        if (permission !== RESULTS.GRANTED) {
          Toast.show({
            type: 'error',
            text1: 'Permission Denied',
            text2: 'Cannot save video without photo library permission',
            position: 'bottom',
          });
          setDownloadingVideo(false);
          return;
        }
      }
      
      // Create appropriate filename
      const filename = videoUrl.substring(videoUrl.lastIndexOf('/') + 1);
      const extension = filename.split('.').pop() || 'mp4';
      const newFilename = `matrix_ai_video_${Date.now()}.mp4`; // Always use .mp4 for iOS compatibility
      
      // Determine where to save the file based on platform
      const targetPath = Platform.OS === 'ios' 
        ? `${RNFS.DocumentDirectoryPath}/${newFilename}`
        : `${RNFS.PicturesDirectoryPath}/${newFilename}`;
      
      console.log('Downloading to path:', targetPath);
      
      // Download the file
      const download = RNFS.downloadFile({
        fromUrl: videoUrl,
        toFile: targetPath,
        background: true,
        discretionary: true,
        progressDivider: 10,
        begin: (res) => {
          console.log('Download started, total size:', res.contentLength);
        },
        progress: (res) => {
          const progressPercent = (res.bytesWritten / res.contentLength) * 100;
          console.log(`Download progress: ${progressPercent.toFixed(2)}%`);
        }
      });
      
      // Wait for the download to complete
      const result = await download.promise;
      console.log('Download result:', result);
      
      if (result.statusCode === 200) {
        // For Android: Make the file visible in gallery
        if (Platform.OS === 'android') {
          Toast.show({
            type: 'success',
            text1: 'Download Complete',
            text2: 'Video has been saved to your gallery',
            position: 'bottom',
          });
          
          // Use the MediaScanner to refresh the gallery
          await RNFS.scanFile(targetPath);
        } else if (Platform.OS === 'ios') {
          // For iOS: Save to Camera Roll with enhanced error handling
          console.log('Starting iOS video save process...');
          
          // First verify the file exists
          const fileExists = await RNFS.exists(targetPath);
          console.log('File exists:', fileExists);
          if (!fileExists) {
            throw new Error('Downloaded file not found');
          }
          
          // Get file stats to verify it's not empty
          const fileStats = await RNFS.stat(targetPath);
          console.log('File stats:', fileStats);
          if (fileStats.size === 0) {
            throw new Error('Downloaded file is empty');
          }
          
          // Try to save to Photos without album specification (more reliable)
          try {
            await CameraRoll.save(`file://${targetPath}`, {
              type: 'video'
            });
            console.log('Video saved to Photos successfully');
            
            // Show toast notification
            Toast.show({
              type: 'success',
              text1: 'Download Complete',
              text2: 'Video has been saved to your Photos',
              position: 'bottom',
            });
            
            // Clean up the file from Documents directory after saving to Photos
            try {
              await RNFS.unlink(targetPath);
              console.log('Cleaned up temporary file');
            } catch (cleanupError) {
              console.log('Could not clean up temporary file:', cleanupError);
            }
          } catch (saveError) {
            console.error('Error saving to Photos:', saveError);
            // If saving to Photos fails, at least the file is downloaded
            Toast.show({
              type: 'info',
              text1: 'Download Complete',
              text2: 'Video downloaded but could not save to Photos. Check Files app.',
              position: 'bottom',
            });
          }
        }
      } else {
        throw new Error('Download failed with status code: ' + result.statusCode);
      }
    } catch (error) {
      console.error('Error downloading video:', error);
      Toast.show({
        type: 'error',
        text1: 'Download Failed',
        text2: 'Could not save the video. Please try again.',
        position: 'bottom',
      });
    } finally {
      setDownloadingVideo(false);
    }
  };

  const handleShareVideo = async () => {
    if (!videoUrl) return;
    
    try {
      // Create a temporary path to save the video for sharing
      const filename = videoUrl.substring(videoUrl.lastIndexOf('/') + 1);
      const extension = filename.split('.').pop() || 'mp4';
      const tempFilename = `matrix_ai_video_${Date.now()}.${extension}`;
      const tempFilePath = `${RNFS.TemporaryDirectoryPath}/${tempFilename}`;
      
      // Download the file to temporary location
      const download = RNFS.downloadFile({
        fromUrl: videoUrl,
        toFile: tempFilePath,
      });
      
      // Wait for download to complete
      const result = await download.promise;
      
      if (result.statusCode === 200) {
        // Share the video
        const shareOptions = {
          title: 'Share Video',
          url: `file://${tempFilePath}`,
          type: `video/${extension}`,
          failOnCancel: false,
        };
        
        await Share.open(shareOptions);
        
        // Clean up the temporary file
        try {
          await RNFS.unlink(tempFilePath);
        } catch (cleanupError) {
          console.error('Error cleaning up temp file:', cleanupError);
        }
      } else {
        throw new Error('Download failed with status code: ' + result.statusCode);
      }
    } catch (error) {
      console.error('Error sharing video:', error);
      if (error.message !== 'User did not share') {
        Alert.alert(t('error'), t('failedToShareVideo'));
      }
    }
  };

  // Create shimmer interpolation
  const shimmerTranslate = shimmerValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width],
  });

  // Determine loading text with animated dots
  const loadingText = `Creating${'.'.repeat(loadingDots.__getValue())}`;

  const renderSkeleton = () => (
    <View style={styles.videoContainer}>
      <View style={[styles.videoSkeleton, {backgroundColor: colors.border}]}>
        <Animated.View
          style={[
            styles.shimmerOverlay,
            {
              transform: [{ translateX: shimmerTranslate }],
            },
          ]}
        />
        <View style={styles.playButtonSkeleton}>
          <MaterialIcons name="play-circle-filled" size={60} color={colors.text} />
        </View>
      </View>
    </View>
  );

  const renderVideo = () => (
    <Animated.View
      style={[
        styles.videoContainer,
        {
          opacity: videoOpacity,
          transform: [{ scale: videoScale }],
        },
      ]}
    >
      <LinearGradient
        colors={['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.1)']}
        style={styles.videoBorder}
      >
        <TouchableOpacity onPress={openVideoModal} style={styles.videoWrapper}>
          <Video
            source={{ uri: videoUrl }}
            style={styles.video}
            resizeMode="contain"
            paused={!isPlaying}
            repeat={false}
            muted={false}
            onEnd={handleVideoEnd}
          />
          <View style={styles.playOverlay}>
            <TouchableOpacity 
              style={styles.playButton}
              onPress={() => setIsPlaying(!isPlaying)}
            >
              <MaterialIcons 
                name={isPlaying ? "pause-circle-filled" : "play-circle-filled"} 
                size={60} 
                color="rgba(255,255,255,0.9)" 
              />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.expandButton}
          onPress={openVideoModal}
        >
          <MaterialIcons name="fullscreen" size={18} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );

  const getStatusText = () => {
    switch (taskStatus) {
      case 'PENDING':
        return 'Initializing video generation...';
      case 'PROCESSING':
        return 'Generating your video...';
      case 'SUCCEEDED':
        return 'Video generated successfully!';
      case 'FAILED':
        return 'Video generation failed';
      default:
        return 'Processing...';
    }
  };

  const getStatusColor = () => {
    switch (taskStatus) {
      case 'SUCCEEDED':
        return '#4CAF50';
      case 'FAILED':
        return '#F44336';
      default:
        return colors.primary;
    }
  };

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <Animatable.View 
        animation="fadeIn" 
        duration={600} 
        style={styles.header}
      >
        <TouchableOpacity 
          style={[styles.backButton, {backgroundColor: colors.primary}]} 
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <Text style={[styles.heading, {color: colors.text}]}>
          {loading ? "AI Video Generation" : "AI Generated Video"}
        </Text>
      </Animatable.View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Prompt Display */}
        <Animatable.View 
          animation="fadeIn" 
          delay={300}
          style={styles.promptContainer}
        >
          <Text style={styles.promptLabel}>PROMPT</Text>
          <Text style={[styles.promptText, {color: '#00A1F7FF'}]}>{truncatedMessage}</Text>
        </Animatable.View>

        {loading ? (
          <>
            <Animatable.View 
              animation="fadeIn" 
              delay={400}
              style={styles.loadingContainer}
            >
              <View style={styles.loadingIndicator}>
                <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulseAnim }] }]}>
                  <LottieView
                    source={require('../assets/image2.json')}
                    autoPlay
                    loop
                    style={{width: '100%', height: 100, backgroundColor: 'transparent'}}
                  />
                </Animated.View>
              </View>
              <Text style={[styles.loadingText, {color: colors.text}]}>{loadingText}</Text>
              <Text style={[styles.subtext, {color: colors.text}]}>
                Please don't leave this screen while the video is being generated
              </Text>
            </Animatable.View>
          </>
        ) : null}

        {/* Video Content */}
        {(loading || showSkeleton) ? renderSkeleton() : videoUrl ? renderVideo() : null}

        {/* Action Buttons */}
        {!loading && !showSkeleton && (
          <Animatable.View 
            animation="fadeInUp" 
            duration={600}
            style={styles.buttonsContainer}
          >
            <TouchableOpacity 
              style={styles.tryAgainButton} 
              onPress={handleTryAgain}
            >
              <MaterialIcons name="refresh" size={20} color="#000" />
              <Text style={styles.tryAgainText}>Try Again</Text>
            </TouchableOpacity>
            
            {videoUrl && (
              <>
                <TouchableOpacity
                  style={[styles.downloadButton]}
                  onPress={handleDownloadVideo}
                  disabled={downloadingVideo}
                >
                  {downloadingVideo ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <MaterialIcons name="file-download" size={20} color="#fff" />
                  )}
                  <Text style={styles.downloadText}>Download</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.shareButton]}
                  onPress={handleShareVideo}
                >
                  <MaterialIcons name="ios-share" size={20} color="#fff" />
                  <Text style={styles.shareText}>Share</Text>
                </TouchableOpacity>
              </>
            )}
          </Animatable.View>
        )}
      </ScrollView>

      {/* Full Screen Video Modal */}
      <Modal
        visible={modalVisible}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              onPress={() => setModalVisible(false)}
              style={styles.closeButton}
            >
              <MaterialIcons name="close" size={30} color="#fff" />
            </TouchableOpacity>
          </View>
          
          {videoUrl && (
            <Video
              source={{ uri: videoUrl }}
              style={styles.fullScreenVideo}
              resizeMode="contain"
              controls={true}
              paused={false}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  heading: {
    fontSize: 20,
    fontWeight: "600",
    color: '#fff',
    flex: 1,
  },
  promptContainer: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  promptLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8A8A8A',
    marginBottom: 8,
    letterSpacing: 1,
  },
  promptText: {
    fontSize: 16,
    color: '#00A1F7FF',
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  loadingIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  pulseCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  subtext: {
    fontSize: 12,
    color: '#8A8A8A',
    textAlign: "center",
    maxWidth: '85%',
  },
  videoContainer: {
    width: width * 0.85,
    height: width * 0.85 * 0.56, // 16:9 aspect ratio
    alignSelf: 'center',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#2A2A2A',
    marginVertical: 16,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  videoSkeleton: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.3)',
    width: '30%',
  },
  playButtonSkeleton: {
    opacity: 0.5,
  },
  videoBorder: {
    width: '100%',
    height: '100%',
    padding: 2,
    borderRadius: 16,
  },
  videoWrapper: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  playButton: {
    padding: 10,
  },
  expandButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  buttonsContainer: {
    flexDirection: "row",
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 32,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  tryAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', 
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginHorizontal: 4,
    marginVertical: 4,
  },
  tryAgainText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: "#4F74FF",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginHorizontal: 4,
    marginVertical: 4,
  },
  downloadText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: "#28A745",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginHorizontal: 4,
    marginVertical: 4,
  },
  shareText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 20,
  },
  closeButton: {
    padding: 10,
  },
  fullScreenVideo: {
    flex: 1,
  },
});

export default CreateVideoScreen;
