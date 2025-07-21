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
  FlatList,
  Platform,
  ToastAndroid,
  PermissionsAndroid,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { SafeAreaView } from 'react-native-safe-area-context';
import { imageService } from '../services/imageService';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import LinearGradient from 'react-native-linear-gradient';
import * as Animatable from 'react-native-animatable';
import LottieView from "lottie-react-native";
import { useAuthUser } from '../hooks/useAuthUser';
import { useFocusEffect } from '@react-navigation/native';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import Toast from 'react-native-toast-message';
import { PERMISSIONS, request, RESULTS } from 'react-native-permissions';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
const { width, height } = Dimensions.get("window");

const MAX_PROMPT_LENGTH = 100; // Maximum characters before truncation

const CreateImagesScreen = ({ route, navigation }) => {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  const { t } = useLanguage();
  const { message, imageCount = 1, uid: routeUid, imageUrl } = route.params; // Extract text, imageCount, uid and imageUrl from params
  const [images, setImages] = useState([]); // Store the generated image URLs
  const [loading, setLoading] = useState(true); // Track loading state
  const [modalVisible, setModalVisible] = useState(false); // Modal visibility state
  const [currentViewingImage, setCurrentViewingImage] = useState(null);
  const [showSkeleton, setShowSkeleton] = useState(true); // Control skeleton visibility
  const { uid: authUid } = useAuthUser();  
  const [downloadingImageId, setDownloadingImageId] = useState(null);
  const [uploadedImage, setUploadedImage] = useState(imageUrl || null); // Store the uploaded image URL
  
  // Animated values
  const shimmerValue = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const loadingDots = useRef(new Animated.Value(0)).current;
  const imageOpacity = useRef(new Animated.Value(0)).current;
  const imageScale = useRef(new Animated.Value(0.95)).current;

  // Format prompt for display
  const truncatedMessage = message.length > MAX_PROMPT_LENGTH 
    ? `${message.substring(0, MAX_PROMPT_LENGTH)}...` 
    : message;

  // Load images when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      // This runs when the screen comes into focus
      // Clear any previously stored images and reset state
      setImages([]);
      setUploadedImage(null);
      setCurrentViewingImage(null);
      setModalVisible(false);
      setShowSkeleton(true);
      setLoading(true);
      
      // Fetch new images
      fetchAndStoreImages(true);
      
      // This runs when the screen goes out of focus
      return () => {
        // Clear state when navigating away
        setImages([]);
        setCurrentViewingImage(null);
        setModalVisible(false);
      };
    }, [message, imageCount])
  );

  // Function to clear stored images
  const clearStoredImages = async () => {
    try {
      await AsyncStorage.removeItem("downloadedImages");
    } catch (error) {
      console.error("Error clearing stored images:", error);
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
      setImages([]);
      setCurrentViewingImage(null);
      clearStoredImages();
    };
  }, [shimmerValue, pulseAnim, loadingDots]);

  // Function to fetch and process images
  const fetchAndStoreImages = async (forceRefresh = false) => {
    try {
      // Check if we have stored images first (only if not forcing refresh)
      if (!forceRefresh) {
        const storedImages = await AsyncStorage.getItem("downloadedImages");
        console.log('Checking stored images:', storedImages);
        
        if (storedImages) {
          try {
            const parsedImages = JSON.parse(storedImages);
            console.log('Found stored images:', parsedImages);
            
            // Extract image URLs - handle different possible property names
            const imageUrls = parsedImages.map(img => {
              // Check for different possible property names
              const url = img.imageUrl || img.image_url || img.url;
              console.log('Stored image object:', img, 'Using URL:', url);
              return url;
            });
            
            setImages(imageUrls);
            setShowSkeleton(false);
            setLoading(false);
            fadeInImage();
            return;
          } catch (parseError) {
            console.error('Error parsing stored images:', parseError);
          }
        }
      }
      
      // Clear any previously stored images when fetching new ones
      await clearStoredImages();
      
      setLoading(true);
      setShowSkeleton(true);
      
      // Reset animation values
      imageOpacity.setValue(0);
      imageScale.setValue(0.95);
      
      try {
        // Direct image generation without polling for status
        const userId = routeUid || authUid;
        console.log('Generating images with direct API call for UID:', userId);
        console.log('Prompt:', message);
        console.log('Image count:', imageCount);
        console.log('Uploaded image URL:', uploadedImage);
        
        let response;
        
        // If we have an uploaded image URL, use the createImageFromUrl API
        if (uploadedImage) {
          console.log('Using createImageFromUrl API with image:', uploadedImage);
          response = await fetch('https://main-matrixai-server-lujmidrakh.cn-hangzhou.fcapp.run/api/image/createImageFromUrl', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              uid: userId,
              promptText: message,
              userImageUrl: uploadedImage
            })
          });
        } else {
          // Otherwise use the standard createImage API
          console.log('Using standard createImage API');
          response = await fetch('https://main-matrixai-server-lujmidrakh.cn-hangzhou.fcapp.run/api/image/createImage', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              uid: userId,
              promptText: message,
              imageCount
            })
          });
        }
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('API error response:', errorText);
          throw new Error(`API error: ${response.status} ${errorText}`);
        }
        
        const data = await response.json();
        console.log('Direct API response:', JSON.stringify(data));
        
        // Handle different response formats based on which API was used
        if (uploadedImage) {
          // For createImageFromUrl API, which returns a single image
          if (data && data.imageUrl) {
            console.log('Enhanced image received:', data.imageUrl);
            
            const imageData = [{
              imageUrl: data.imageUrl,
              imageId: data.imageId || null,
              imageName: data.imageName || null
            }];
            
            await AsyncStorage.setItem("downloadedImages", JSON.stringify(imageData));
            setImages([data.imageUrl]);
            
            // Show skeleton for 1 second before revealing the images for uploaded images too
            setTimeout(() => {
              setShowSkeleton(false);
              setLoading(false);
              fadeInImage();
            }, 1000);
          } else {
            throw new Error('No enhanced image was generated');
          }
        } else if (data && data.images && data.images.length > 0) {
          // For standard createImage API, which returns an array of images
          console.log('Image data received:', JSON.stringify(data.images));
          
          // Extract image URLs - handle different possible property names
          const imageUrls = data.images.map(img => {
            // Check for different possible property names
            const url = img.imageUrl || img.image_url || img.url;
            console.log('Image object:', img, 'Using URL:', url);
            return url;
          });
          console.log('Extracted image URLs:', imageUrls);
          
          await AsyncStorage.setItem("downloadedImages", JSON.stringify(data.images));
          setImages(imageUrls);
          
          // Show skeleton for 1 second before revealing the images
          setTimeout(() => {
            setShowSkeleton(false);
            setLoading(false);
            fadeInImage();
          }, 1000);
        } else {
          throw new Error('No images were generated');
        }
      } catch (apiError) {
        console.error('Direct API call failed:', apiError);
        throw apiError;
      }
    } catch (error) {
      console.error("Error fetching images:", error);
      setLoading(false);
      setShowSkeleton(false);
      Alert.alert("Error", error.message || "Something went wrong. Please try again.");
    }
  };

  const fadeInImage = () => {
    Animated.parallel([
      Animated.timing(imageOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(imageScale, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleTryAgain = () => {
    setImages([]);
    // Reset animations
    imageOpacity.setValue(0);
    imageScale.setValue(0.95);
    // Fetch new images with force refresh to bypass cached images
    fetchAndStoreImages(true);
  };

  const openImageModal = (url) => {
    setCurrentViewingImage(url);
    setModalVisible(true);
  };

  // Determine loading text with animated dots
  const loadingText = `Creating${'.'.repeat(loadingDots.__getValue())}`;

  // Create shimmer interpolation
  const shimmerTranslate = shimmerValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width],
  });

  const renderSkeleton = () => {
    // If we have an uploaded image, show it with a scanning animation
    if (uploadedImage) {
      return renderUploadedImageWithScanning();
    } else if (imageCount === 1) {
      return renderSingleSkeleton();
    } else {
      return (
        <View style={styles.gridContainer}>
          {[...Array(imageCount)].map((_, index) => (
            <View key={index} style={styles.gridItem}>
              <View style={styles.gridImageSkeleton}>
                <Animated.View
                  style={[
                    styles.shimmer,
                    { transform: [{ translateX: shimmerTranslate }] },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      );
    }
  };

  // Render the uploaded image with enhanced UI for processed state
  const renderProcessedUploadedImage = () => (
    <View style={styles.singleContainer}>
      <LinearGradient
        colors={['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.1)']}
        style={styles.imageBorder}
      >
        <Image
          source={{ uri: images[0] }}
          style={styles.image}
          resizeMode="contain"
        />
        <TouchableOpacity 
          style={styles.expandButton}
          onPress={() => openImageModal(images[0])}
        >
          <MaterialIcons name="fullscreen" size={18} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );

  const renderUploadedImageWithScanning = () => (
    <View style={styles.singleContainer}>
      <View style={styles.uploadedImageContainer}>
        <Image
          source={{ uri: uploadedImage }}
          style={styles.uploadedImage}
          resizeMode="contain"
        />
        <Animated.View
          style={[
            styles.scanningOverlay,
            { 
              transform: [{ translateY: shimmerValue.interpolate({
                inputRange: [0, 1],
                outputRange: [-20, height/1.5]
              }) }],
              opacity: shimmerValue.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0.8, 1, 0.8]
              })
            },
          ]}
        />
        <Animated.View
          style={[
            styles.magicParticles,
            {
              opacity: shimmerValue.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, 1, 0]
              })
            }
          ]}
        />
        <View style={styles.processingTextContainer}>
          <Text style={styles.processingText}>Enhancing image with AI...</Text>
        </View>
      </View>
    </View>
  );

  const renderSingleSkeleton = () => (
    <View style={styles.singleContainer}>
      <View style={styles.imageSkeleton}>
        <Animated.View
          style={[
            styles.shimmer,
            { transform: [{ translateX: shimmerTranslate }] },
          ]}
        />
      </View>
    </View>
  );

  const renderSingleImage = () => (
    <Animated.View 
      style={[
        styles.singleContainer, 
        { 
          opacity: imageOpacity,
          transform: [{ scale: imageScale }] 
        }
      ]}
    >
      <LinearGradient
        colors={['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.1)']}
        style={styles.imageBorder}
      >
        {images.length > 0 ? (
          <Image
            source={{ uri: images[0] }}
            style={styles.image}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.placeholderContainer}>
            <MaterialIcons name="image-not-supported" size={32} color="#555" />
          </View>
        )}
        
        <TouchableOpacity 
          style={styles.expandButton}
          onPress={() => openImageModal(images[0])}
        >
          <MaterialIcons name="fullscreen" size={18} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );

  const renderGridImages = () => (
    <Animated.View 
      style={[
        styles.gridContainer, 
        { 
          opacity: imageOpacity,
          transform: [{ scale: imageScale }] 
        }
      ]}
    >
      {images.map((url, index) => (
        <View key={index} style={styles.gridItem}>
          <LinearGradient
            colors={['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.1)']}
            style={styles.gridImageBorder}
          >
            <Image
              source={{ uri: url }}
              style={styles.gridImage}
              resizeMode="cover"
            />
            
            <TouchableOpacity 
              style={styles.gridExpandButton}
              onPress={() => openImageModal(url)}
            >
              <MaterialIcons name="fullscreen" size={16} color="#fff" />
            </TouchableOpacity>
          </LinearGradient>
        </View>
      ))}
    </Animated.View>
  );

  const handleDownloadImage = async (imageUrl, imageId = null) => {
    try {
      // Set downloading state
      setDownloadingImageId(imageId || imageUrl);
      
      // Request storage permission (for Android)
      if (Platform.OS === 'android') {
        const permission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Storage Permission',
            message: 'Matrix AI needs access to your storage to save images.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        
        if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
          Toast.show({
            type: 'error',
            text1: 'Permission Denied',
            text2: 'Cannot save image without storage permission',
            position: 'bottom',
          });
          setDownloadingImageId(null);
          return;
        }
      } else if (Platform.OS === 'ios') {
        // For iOS, request photo library permission
        const permission = await request(PERMISSIONS.IOS.PHOTO_LIBRARY);
        if (permission !== RESULTS.GRANTED) {
          Toast.show({
            type: 'error',
            text1: 'Permission Denied',
            text2: 'Cannot save image without photo library permission',
            position: 'bottom',
          });
          setDownloadingImageId(null);
          return;
        }
      }
      
      // Create appropriate filename
      const filename = imageUrl.substring(imageUrl.lastIndexOf('/') + 1);
      const extension = filename.split('.').pop() || 'jpg';
      const newFilename = `matrix_ai_image_${Date.now()}.${extension}`;
      
      // Determine where to save the file based on platform
      const targetPath = Platform.OS === 'ios' 
        ? `${RNFS.DocumentDirectoryPath}/${newFilename}`
        : `${RNFS.PicturesDirectoryPath}/${newFilename}`;
      
      // Download the file
      const download = RNFS.downloadFile({
        fromUrl: imageUrl,
        toFile: targetPath,
        background: true,
        discretionary: true,
      });
      
      // Wait for the download to complete
      const result = await download.promise;
      
      if (result.statusCode === 200) {
        // For Android: Make the file visible in gallery
        if (Platform.OS === 'android') {
          // Use ToastAndroid for native toast on Android
          ToastAndroid.show('Image saved to gallery', ToastAndroid.SHORT);
          
          // Use the MediaScanner to refresh the gallery
          await RNFS.scanFile(targetPath);
        } else if (Platform.OS === 'ios') {
          // For iOS: Save to Camera Roll
          await CameraRoll.save(`file://${targetPath}`, {
            type: 'photo',
            album: 'MatrixAI'
          });
          
          // Show toast notification
          Toast.show({
            type: 'success',
            text1: 'Download Complete',
            text2: 'Image has been saved to your Photos',
            position: 'bottom',
          });
        }
      } else {
        throw new Error('Download failed with status code: ' + result.statusCode);
      }
    } catch (error) {
      console.error('Error downloading image:', error);
      Toast.show({
        type: 'error',
        text1: 'Download Failed',
        text2: 'Could not save the image. Please try again.',
        position: 'bottom',
      });
    } finally {
      setDownloadingImageId(null);
    }
  };
  
  const handleShareImage = async (imageUrl) => {
    try {
      // Create a temporary path to save the image for sharing
      const filename = imageUrl.substring(imageUrl.lastIndexOf('/') + 1);
      const extension = filename.split('.').pop() || 'jpg';
      const tempFilename = `matrix_ai_image_${Date.now()}.${extension}`;
      const tempFilePath = `${RNFS.TemporaryDirectoryPath}/${tempFilename}`;
      
      // Download the file to temporary location
      const download = RNFS.downloadFile({
        fromUrl: imageUrl,
        toFile: tempFilePath,
      });
      
      // Wait for download to complete
      const result = await download.promise;
      
      if (result.statusCode === 200) {
        // Share the image
        const shareOptions = {
          title: 'Share Image',
          url: `file://${tempFilePath}`,
          type: `image/${extension}`,
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
      console.error('Error sharing image:', error);
      if (error.message !== 'User did not share') {
        Alert.alert(t('error'), t('failedToShareImage'));
      }
    }
  };

  return (
    <>
      <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
        <StatusBar barStyle="light-content" />
        
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
            {loading ? t('aiImageGeneration') : t('aiImageGenerated')}
          </Text>
        </Animatable.View>

        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animatable.View 
            animation="fadeIn" 
            delay={300}
            style={styles.promptContainer}
          >
            <Text style={styles.promptLabel}>{t('prompt')}</Text>
            <LinearGradient
              colors={[colors.card, colors.card + '80']}
              style={styles.promptBox}
            >
              <Text style={[styles.promptText, {color: '#E66902'}]}>{truncatedMessage}</Text>
            </LinearGradient>
          </Animatable.View>

          {loading && showSkeleton ? (
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
                <Text style={[styles.loadingText, {color: colors.text}]}>{t('creatingYourImages')}</Text>
                <Text style={[styles.subtext, {color: colors.text}]}>
                  {t('pleaseDontLeaveThisScreenWhileImagesAreBeingGenerated')}
                </Text>
              </Animatable.View>
              
              {uploadedImage ? renderUploadedImageWithScanning() : (imageCount === 1 ? renderSingleSkeleton() : renderSkeleton())}
            </>
          ) : (
            <>
              {uploadedImage && images.length > 0 ? renderProcessedUploadedImage() : (imageCount === 1 ? renderSingleImage() : renderGridImages())}
              
              {!loading && (
                <Animatable.View 
                  animation="fadeInUp" 
                  duration={600}
                  style={styles.buttonsContainer}
                >
                  <View style={styles.topButtonsRow}>
                    <TouchableOpacity 
                      style={[styles.tryAgainButton, styles.halfWidthButton]} 
                      onPress={handleTryAgain}
                    >
                      <MaterialIcons name="refresh" size={20} color="#000" />
                      <Text style={styles.tryAgainText}>Try Again</Text>
                    </TouchableOpacity>
                    
                    {images.length > 0 && (
                      <TouchableOpacity
                        style={[styles.downloadButton, {backgroundColor: '#28a745'}, styles.halfWidthButton]}
                        onPress={() => handleShareImage(images[0])}
                      >
                        <MaterialIcons name="ios-share" size={20} color="#fff" />
                        <Text style={styles.downloadText}>Share</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  {images.length > 0 && (
                    <TouchableOpacity
                      style={[styles.downloadButton, styles.fullWidthButton]}
                      onPress={() => handleDownloadImage(images[0], 'single-image')}
                      disabled={downloadingImageId === 'single-image'}
                    >
                      {downloadingImageId === 'single-image' ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <MaterialIcons name="file-download" size={20} color="#fff" />
                      )}
                      <Text style={styles.downloadText}>
                        {downloadingImageId === 'single-image' ? 'Saving...' : 'Download'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </Animatable.View>
              )}
            </>
          )}
        </ScrollView>

        {/* Image Preview Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <Animatable.View 
              animation="zoomIn" 
              duration={300}
              style={[
                styles.modalContent,
                {backgroundColor: colors.card}
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, {color: colors.text}]}>Image Preview</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setModalVisible(false)}
                >
                  <MaterialIcons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.modalImageContainer}>
                <Image
                  source={{ uri: currentViewingImage }}
                  style={styles.modalImage}
                  resizeMode="contain"
                />
              </View>
              
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalActionButton}
                  onPress={() => handleDownloadImage(currentViewingImage, 'modal-image')}
                  disabled={downloadingImageId === 'modal-image'}
                >
                  {downloadingImageId === 'modal-image' ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <MaterialIcons name="file-download" size={20} color="#fff" />
                  )}
                  <Text style={styles.modalActionText}>
                    {downloadingImageId === 'modal-image' ? 'Saving...' : 'Download'}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.modalActionButton, {backgroundColor: '#28a745'}]}
                  onPress={() => handleShareImage(currentViewingImage)}
                >
                  <MaterialIcons name="ios-share" size={20} color="#fff" />
                  <Text style={styles.modalActionText}>Share</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setModalVisible(false)}
                >
                  <MaterialIcons name="close" size={20} color="#000" />
                  <Text style={styles.closeButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </Animatable.View>
          </View>
        </Modal>
      </SafeAreaView>
      <Toast />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  uploadedImageContainer: {
    width: 300,
    height: 300,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginVertical: 20,
    borderWidth: 1,
    borderColor: 'rgba(73, 143, 255, 0.5)',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  scanningOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: 'rgba(73, 143, 255, 0.3)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(73, 143, 255, 0.8)',
    shadowColor: '#498FFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 5,
  },
  processingTextContainer: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 8,
  },
  processingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  magicParticles: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(73, 143, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(73, 143, 255, 0.3)',
    shadowColor: '#498FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 5,
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
    marginTop: 8,
  },
  promptLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8A8A8A',
    marginBottom: 4,
    letterSpacing: 1,
  },
  promptBox: {
    padding: 12,
    borderRadius: 12,
    minHeight: 60,
  },
  promptText: {
    fontSize: 16,
    color: '#E66902',
    fontWeight: '500',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
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
  singleContainer: {
    width: width * 0.85,
    height: width * 0.85,
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
  gridContainer: {
    width: width * 0.9,
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginVertical: 16,
  },
  gridItem: {
    width: (width * 0.9 - 12) / 2,
    height: (width * 0.9 - 12) / 2,
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#2A2A2A',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  imageBorder: {
    width: '100%',
    height: '100%',
    padding: 2,
    borderRadius: 16,
  },
  gridImageBorder: {
    width: '100%',
    height: '100%',
    padding: 2,
    borderRadius: 12,
  },
  imageSkeleton: {
    width: "100%",
    height: "100%",
    backgroundColor: "#2A2A2A",
    overflow: "hidden",
    position: "relative",
    borderRadius: 16,
  },
  gridImageSkeleton: {
    width: "100%",
    height: "100%",
    backgroundColor: "#2A2A2A",
    overflow: "hidden",
    position: "relative",
    borderRadius: 12,
  },
  shimmer: {
    width: "30%",
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.1)",
    position: "absolute",
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
  },
  gridImage: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
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
  gridExpandButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonsContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
    marginTop: 32,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  topButtonsRow: {
    flexDirection: "row",
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 12,
  },
  halfWidthButton: {
    flex: 0.48,
  },
  fullWidthButton: {
    width: '100%',
  },
  tryAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', 
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginHorizontal: 8,
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
    marginHorizontal: 8,
  },
  downloadText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
  },
  modalContent: {
    width: "90%",
    maxHeight: "80%",
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalImageContainer: {
    height: height * 0.4,
    backgroundColor: '#0F0F0F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImage: {
    width: "100%",
    height: "100%",
  },
  modalActions: {
    padding: 16,
    paddingBottom: 24,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  modalActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: "#4F74FF",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    width: '80%',
  },
  modalActionText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', 
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    width: '80%',
  },
  closeButtonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
});

export default CreateImagesScreen;
