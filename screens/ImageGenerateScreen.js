import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  FlatList,
  ActivityIndicator,
  Alert,
  ToastAndroid,
  PermissionsAndroid,
  Modal
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { generateUniqueFileName } from '../utils/fileUploadUtils';
import { supabase } from '../supabaseClient';

import { imageService } from '../services/imageService';
import LottieView from 'lottie-react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuthUser } from '../hooks/useAuthUser';
import { useCoinsSubscription } from '../hooks/useCoinsSubscription';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import Toast from 'react-native-toast-message';
import { PERMISSIONS, request, RESULTS } from 'react-native-permissions';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import LinearGradient from 'react-native-linear-gradient';
import * as Animatable from 'react-native-animatable';
const { width, height } = Dimensions.get('window');

const ImageGenerateScreen = () => {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  const { t } = useLanguage();
  const [userText, setUserText] = useState('');
  const [isFinished, setIsFinished] = useState(false);
  const [transcription, setTranscription] = useState(
    t('startWritingToGenerateImages')
  );
  const [selectedImages, setSelectedImages] = useState([]);
  const [uploadedImageUrls, setUploadedImageUrls] = useState([]);
  const [uploadingImages, setUploadingImages] = useState([]);
  
  // Initialize animated values with useRef to prevent re-creation on re-renders
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const sendRotation = useRef(new Animated.Value(0)).current;
  const historySlideAnim = useRef(new Animated.Value(width)).current;
  
  const navigation = useNavigation();
  const [historyOpen, setHistoryOpen] = useState(false);
  const { uid, loading } = useAuthUser();
  const coinCount = useCoinsSubscription(uid);
  const [lowBalanceModalVisible, setLowBalanceModalVisible] = useState(false);
  const [requiredCoins, setRequiredCoins] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  
  // Replace mock data with actual state
  const [imageHistory, setImageHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [hasMoreImages, setHasMoreImages] = useState(false);
  const imagesPerPage = 10;
  const [downloadingImageId, setDownloadingImageId] = useState(null);
  
  // Add state for full-screen image modal
  const [fullScreenModalVisible, setFullScreenModalVisible] = useState(false);
  const [fullScreenImageUrl, setFullScreenImageUrl] = useState('');
  const [fullScreenImageId, setFullScreenImageId] = useState('');
  const [fullScreenPromptText, setFullScreenPromptText] = useState('');
  
  // Add state for image templates
  const [imageTemplates, setImageTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  
  // Run animations on mount
  useEffect(() => {
    // Start animations when component mounts
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.ease,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.timing(sendRotation, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      )
    ]).start();
  }, [fadeAnim, scaleAnim, sendRotation]);
  
  // Fetch image history when history panel is opened
  useEffect(() => {
    if (historyOpen && uid) {
      fetchImageHistory(1);
    }
  }, [historyOpen, uid]);

  // Fetch image templates when component mounts
  useEffect(() => {
    fetchImageTemplates();
  }, []);

  const fetchImageTemplates = async () => {
    setTemplatesLoading(true);
    setTemplatesError(null);
    
    try {
      const result = await imageService.getAllImagePrompts();
      if (result.success && result.data) {
        // Take only the first 4 templates for the 2x2 grid
        setImageTemplates(result.data.slice(0, 4));
      }
    } catch (err) {
      console.error('Error fetching image templates:', err);
      setTemplatesError(err.message);
    } finally {
      setTemplatesLoading(false);
    }
  };

  const fetchImageHistory = async (page = 1) => {
    if (!uid) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await imageService.getImageHistory(uid, page, imagesPerPage);
      const newImages = result.data || [];
      
      if (page === 1) {
        setImageHistory(newImages);
      } else {
        setImageHistory(prev => [...prev, ...newImages]);
      }
      
      setHistoryPage(page);
      setHasMoreImages(newImages.length >= imagesPerPage);
    } catch (err) {
      console.error('Error fetching image history:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreImages = () => {
    if (!isLoading && hasMoreImages) {
      fetchImageHistory(historyPage + 1);
    }
  };
  
  const handleRemoveImage = async (imageId) => {
    if (!uid || !imageId) return;
    
    try {
      Alert.alert(
        t('removeImage'),
        t('areYouSureYouWantToRemoveThisImage'),
        [
          {
            text: t('cancel'),
            style: "cancel"
          },
          {
            text: t('remove'),
            onPress: async () => {
              setIsLoading(true);
              try {
                await imageService.removeImage(uid, imageId);
                
                // Remove the image from the local state
                setImageHistory(prev => prev.filter(img => img.image_id !== imageId));
              } catch (error) {
                console.error('Error removing image:', error);
                Alert.alert(t('error'), t('failedToRemoveImage'));
              } finally {
                setIsLoading(false);
              }
            }
          }
        ]
      );
    } catch (err) {
      console.error('Error removing image:', err);
      Alert.alert(t('error'), t('failedToRemoveImage'));
      setIsLoading(false);
    }
  };

  const toggleHistory = () => {
    // Toggle the history state
    setHistoryOpen(!historyOpen);
    
    // Animate the panel
    Animated.timing(historySlideAnim, {
      toValue: historyOpen ? width : 0,
      duration: 300,
      easing: Easing.ease,
      useNativeDriver: true,
    }).start();
  };
  
  const handleSend = () => {
    if (userText.trim().length > 0) {
      setIsFinished(true); // Show buttons after sending the input
      setSelectedImages([]); // Hide the attached images when send button is pressed
      // Keep the uploadedImageUrls for API call but hide the UI
    }
  };

  // Check if send button should be disabled
  const isSendDisabled = () => {
    // Disable if no text is entered
    if (userText.trim().length === 0) {
      return true;
    }
    
    // Disable if any image is still uploading
    const hasUploadingImages = selectedImages.some(image => image.uploading === true);
    if (hasUploadingImages) {
      return true;
    }
    
    return false;
  };

  const handleAttachImage = async () => {
    // Check if we already have 5 images
    if (selectedImages.length >= 5) {
      Alert.alert('Limit Reached', 'You can attach up to 5 images only.');
      return;
    }

    const options = {
      mediaType: 'photo',
      quality: 1,
      includeBase64: true,
      selectionLimit: Math.min(5 - selectedImages.length, 5), // Allow multiple selection up to remaining slots
    };

    try {
      const result = await launchImageLibrary(options);
      if (result.assets && result.assets.length > 0) {
        // Add new images to the existing array
        const newImages = result.assets.map(asset => ({
          uri: asset.uri,
          id: Date.now() + Math.random(), // Generate unique ID for each image
          uploading: true
        }));
        
        setSelectedImages(prev => [...prev, ...newImages]);
        
        // Upload each image
        result.assets.forEach((asset, index) => {
          uploadImageToSupabase(asset, newImages[index].id);
        });
      }
    } catch (error) {
      console.error('Error picking image:', error.message || error);
      Alert.alert('Error', 'Failed to pick image: ' + (error.message || 'Unknown error'));
    }
  };
  
  const uploadImageToSupabase = async (asset, imageId) => {
    try {
      // Update the specific image's uploading status
      setSelectedImages(prev => prev.map(img => 
        img.id === imageId ? { ...img, uploading: true } : img
      ));
      
      // Get file extension from uri
      const fileExt = asset.uri.substring(asset.uri.lastIndexOf('.') + 1);
      
      // Generate unique filename to prevent duplicates
      const originalName = `image.${fileExt}`;
      const uniqueFileName = generateUniqueFileName(originalName, uid);
      const filePath = `user-uploads/${uniqueFileName}`;

      // For iOS, we need to handle the file:// protocol
      let imageUri = asset.uri;
      if (Platform.OS === 'ios' && !imageUri.startsWith('file://')) {
        imageUri = `file://${imageUri}`;
      }
      
      // Read the file as base64
      const fileContent = await RNFS.readFile(imageUri, 'base64');
      
      // Function to decode base64 to array buffer
      const decodeBase64 = (base64) => {
        // React Native doesn't have atob, so we need to implement it
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        let str = base64.replace(/=+$/, '');
        let output = '';
        
        if (str.length % 4 === 1) {
          throw new Error("'atob' failed: The string to be decoded is not correctly encoded.");
        }
        
        for (let bc = 0, bs = 0, buffer, i = 0; buffer = str.charAt(i++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
          buffer = chars.indexOf(buffer);
        }
        
        const byteCharacters = output;
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        return new Uint8Array(byteNumbers);
      };
      
      const arrayBuffer = decodeBase64(fileContent);
      
      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('user-uploads')
        .upload(filePath, arrayBuffer, {
          contentType: asset.type || 'image/jpeg',
          cacheControl: '3600'
        });

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('user-uploads')
        .getPublicUrl(filePath);

      console.log('Upload successful, public URL:', publicUrl);
      
      // Update the specific image with the uploaded URL and remove uploading status
      setSelectedImages(prev => prev.map(img => 
        img.id === imageId ? { ...img, uploading: false, uploadedUrl: publicUrl } : img
      ));
      
      // Add to uploaded URLs array
      setUploadedImageUrls(prev => [...prev, publicUrl]);
    } catch (error) {
      console.error('Error uploading image:', error.message || error);
      Alert.alert('Error', 'Failed to upload image: ' + (error.message || 'Unknown error'));
      
      // Remove the failed image from selectedImages
      setSelectedImages(prev => prev.filter(img => img.id !== imageId));
    }
  };
  
  const handleRemoveAttachedImage = (imageId) => {
    // Remove the image from selectedImages
    setSelectedImages(prev => prev.filter(img => img.id !== imageId));
    
    // Remove the corresponding uploaded URL if it exists
    const imageToRemove = selectedImages.find(img => img.id === imageId);
    if (imageToRemove && imageToRemove.uploadedUrl) {
      setUploadedImageUrls(prev => prev.filter(url => url !== imageToRemove.uploadedUrl));
    }
  };

  const handleTryAgain = () => {
    setIsFinished(false); // Reset to show the input box again
    setUserText(''); // Clear the text input
    setTranscription(
      'Start writing to generate Images (eg: generate tree with red apples)'
    );
  };

  const handleGenerate = () => {
    // Check if user has enough coins (3) for Generate I
    if (coinCount >= 3) {
      navigation.navigate('CreateImageScreen', { 
        message: transcription,
        uid: uid,
        imageUrls: uploadedImageUrls // Pass array of image URLs
      });
    } else {
      setRequiredCoins(3);
      setLowBalanceModalVisible(true);
    }
  };

  const navigateToSubscription = () => {
    setLowBalanceModalVisible(false);
    navigation.navigate('SubscriptionScreen');
  };

  const handleDownloadImage = async (imageUrl, imageId) => {
    try {
      // Set downloading state
      setDownloadingImageId(imageId);
      
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

  const handleImagePress = (imageUrl, imageId, promptText) => {
    setFullScreenImageUrl(imageUrl);
    setFullScreenImageId(imageId);
    setFullScreenPromptText(promptText || '');
    setFullScreenModalVisible(true);
  };

  const closeFullScreenModal = () => {
    setFullScreenModalVisible(false);
    setFullScreenImageUrl('');
    setFullScreenImageId('');
    setFullScreenPromptText('');
  };

  const handleTemplatePress = (template) => {
    setUserText(template.prompt);
    setTranscription(template.prompt);
    // Don't set selectedTemplate here - templates should remain visible until send button is clicked
  };

  const renderImageTemplates = () => {
    if (templatesLoading) {
      return (
        <View style={styles.fullScreenGridContainer}>
          <FlatList
            data={Array.from({ length: 6 })} // Show 6 skeleton items
            keyExtractor={(_, index) => `skeleton-${index}`}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.gridContentContainer}
            numColumns={2}
            renderItem={({ index }) => (
              <View style={[styles.gridImageTemplateItem, styles.skeletonItem]}>
                <View style={styles.gridImageTemplateContainer}>
                  <LinearGradient
                    colors={['rgba(200, 200, 200, 0.1)', 'rgba(200, 200, 200, 0.3)', 'rgba(200, 200, 200, 0.1)']}
                    start={{x: 0, y: 0}}
                    end={{x: 1, y: 1}}
                    style={[styles.gridImageTemplate, styles.skeletonImage]}
                  >
                    <ActivityIndicator size="large" color="#999999" />
                  </LinearGradient>
                  <View style={styles.gridImageTemplateOverlay}>
                    <View style={styles.makeImageButton}>
                      <LinearGradient
                        colors={['rgba(200, 200, 200, 0.1)', 'rgba(200, 200, 200, 0.3)', 'rgba(200, 200, 200, 0.1)']}
                        start={{x: 0, y: 0}}
                        end={{x: 1, y: 0}}
                        style={[styles.skeletonText, {width: 80, height: 20, borderRadius: 10}]}
                      />
                    </View>
                  </View>
                </View>
              </View>
            )}
          />
        </View>
      );
    }

    if (templatesError || imageTemplates.length === 0) {
      return null;
    }

    return (
      <View style={styles.fullScreenGridContainer}>
        <FlatList
          data={imageTemplates}
          numColumns={2}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.gridContentContainer}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={[styles.gridImageTemplateItem, {backgroundColor: colors.surface}]}
              onPress={() => handleTemplatePress(item)}
            >
              <View style={styles.gridImageTemplateContainer}>
                <Image
                  source={{ uri: item.image_url }}
                  style={styles.gridImageTemplate}
                  resizeMode="cover"
                  onError={(error) => {
                    console.log('Image load error:', error);
                  }}
                />
                <View style={styles.gridImageTemplateOverlay}>
                  <View style={styles.makeImageButton}>
                    <MaterialIcons name="image" size={16} color="#fff" />
                    <Text style={styles.makeImageButtonText}>Make Image</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}
          keyExtractor={(item, index) => item.id || index.toString()}
        />
      </View>
    );
  };

  const renderHistorySkeleton = () => (
    <Animatable.View animation="pulse" iterationCount="infinite" style={[styles.historyItem, styles.skeletonItem, {backgroundColor: colors.border}]}>
      <View style={[styles.historyImage, styles.skeletonImage]}>
        <LinearGradient
          colors={['rgba(200, 200, 200, 0.1)', 'rgba(200, 200, 200, 0.3)', 'rgba(200, 200, 200, 0.1)']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 0}}
          style={[styles.historyImage]}
        />
      </View>
      <View style={[styles.historyItemContent, {backgroundColor: colors.border}]}>
        <View style={[styles.skeletonText, {backgroundColor: colors.text + '30'}]} />
        <View style={[styles.skeletonText, {backgroundColor: colors.text + '30', width: '60%', marginTop: 8}]} />
        <View style={styles.historyActions}>
          <View style={[styles.historyActionButton, {backgroundColor: colors.background2}]} />
          <View style={[styles.historyActionButton, {backgroundColor: colors.background2}]} />
          <View style={[styles.historyActionButton, {backgroundColor: colors.background2}]} />
        </View>
      </View>
    </Animatable.View>
  );

  const renderHistoryItem = ({ item }) => (
    <View style={[styles.historyItem, {backgroundColor: colors.border}]}>
      <TouchableOpacity 
        onPress={() => handleImagePress(item.image_url, item.image_id)}
        style={styles.historyImageContainer}
      >
        <Image 
          source={{ uri: item.image_url }} 
          style={styles.historyImage}
          resizeMode="cover"
        />
      </TouchableOpacity>
      <View style={[styles.historyItemContent, {backgroundColor: colors.border}]}>
        <Text style={[styles.historyDate, {color: colors.text}]}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
        <Text style={[styles.historyPrompt, {color: colors.text}]} numberOfLines={2}>
          {item.prompt_text}
        </Text>
        <View style={styles.historyActions}>
          <TouchableOpacity 
            style={[styles.historyActionButton, {backgroundColor: colors.background2}]}
            onPress={() => handleRemoveImage(item.image_id)}
          >
            <MaterialIcons name="delete" size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.historyActionButton, {backgroundColor: colors.background2}]}
            onPress={() => handleDownloadImage(item.image_url, item.image_id)}
            disabled={downloadingImageId === item.image_id}
          >
            {downloadingImageId === item.image_id ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <MaterialIcons name="file-download" size={20} color={colors.text} />
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.historyActionButton, {backgroundColor: colors.background2}]}
            onPress={() => handleShareImage(item.image_url)}
          >
            <MaterialIcons name="ios-share" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={{flex: 1}}>
      <Animated.View style={[styles.container, { opacity: fadeAnim, backgroundColor: colors.background}]}>
        {/* Header Animation */}
       
        <Animated.View style={[styles.header, { transform: [{ scale: scaleAnim }], backgroundColor: colors.background2}]}>
        <TouchableOpacity 
          style={[styles.backButton, {backgroundColor: colors.primary}]} 
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
          <Text style={[styles.headerTitle, {color: colors.text}]}>Image</Text>
          {!isFinished && (
            <TouchableOpacity 
              style={[styles.historyButton, {backgroundColor: colors.primary}]} 
              onPress={toggleHistory}
            >
              <MaterialIcons name="history" size={24} color={'#fff'} />
            </TouchableOpacity>
          )}
        </Animated.View>


        {/* Conditional rendering based on isFinished */}
        {isFinished ? (
          // Matrix logo placeholder when generation is finished
          <View style={styles.matrixLogoContainer}>
            <Image   
              source={require('../assets/matrix.png')}
              style={[styles.matrixLogo, {tintColor: '#FFFFFF'}]}
            />
            <Text style={[styles.matrixLogoText, {color: colors.text}]}>Image Generation</Text>
          </View>
        ) : (
          // Original content when generation is not finished
          <>
            {/* Image Templates */}
            {renderImageTemplates()}
          </>
        )}

        {/* Buttons */}
        {isFinished && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.tryAgainButton]}
              onPress={handleTryAgain}
            >
              <Text style={styles.tryAgainText}>{t('tryAgain')}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.generateButton, { backgroundColor: colors.primary }]} 
              onPress={handleGenerate}
            >
              <View style={styles.generateContent}>
                <Text style={styles.generateText}>{t('generate')}</Text>
                <View style={styles.horizontalContent}>
                  <Text style={styles.coinText}>3</Text>
                  <Image source={require('../assets/coin.png')} style={styles.coinIcon} />
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      {/* Input section with KeyboardAvoidingView properly implemented */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidView}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 10}
      >
        {selectedImages.length > 0 && (
          <View style={styles.attachedImageContainer}>
            <View style={styles.imageCounterContainer}>
              <Text style={[styles.imageCounterText, {color: colors.text}]}>
                {selectedImages.length}/5
              </Text>
            </View>
            <FlatList
              data={selectedImages}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.attachedImageWrapper}>
                  {item.uploading && (
                    <View style={styles.uploadingOverlay}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.uploadingText}>Uploading...</Text>
                    </View>
                  )}
                  <Image source={{ uri: item.uri }} style={styles.attachedImage} />
                  <TouchableOpacity 
                    style={styles.removeImageButton}
                    onPress={() => handleRemoveAttachedImage(item.id)}
                  >
                    <MaterialIcons name="close" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              )}
              contentContainerStyle={{ paddingHorizontal: 5 }}
              ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
            />
          </View>
        )}
        {!isFinished && (
          <View style={styles.textInputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder={t('typeyourprompt')}
              placeholderTextColor="#999999"
              value={userText}
              onChangeText={(text) => {
                setUserText(text); // Update input
                setTranscription(text || 'Start writing to generate Images (eg: generate tree with red apples)');
                // Clear selected template when user starts typing
                if (text && selectedTemplate) {
                  setSelectedTemplate(null);
                }
              }}
            />
            <TouchableOpacity
              style={styles.attachButton}
              onPress={handleAttachImage}
            >
              <View style={styles.attachButtonCircle}>
                <LinearGradient
                  colors={['rgba(0,123,255,0.8)', 'rgba(0,123,255,0.6)']}
                  style={styles.attachButtonGradient}
                >
                  <Image
                    source={require('../assets/upload.png')}
                    style={styles.attachIcon}
                  />
                </LinearGradient>
              </View>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.sendButton, isSendDisabled() && styles.sendButtonDisabled]} 
              onPress={isSendDisabled() ? null : handleSend}
              disabled={isSendDisabled()}
            >
              <Image
                source={require('../assets/send2.png')}
                style={[styles.sendIcon, {tintColor: isSendDisabled() ? '#CCCCCC' : '#FFFFFF'}]}
              />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* History Panel */}
      <Animated.View 
        style={[
          styles.historyPanel, 
          {
            transform: [{ translateX: historySlideAnim }],
            backgroundColor: colors.background2
          }
        ]}
      >
        <View style={styles.historyHeader}>
          <Text style={[styles.historyTitle, {color: colors.text}]}>{t('generationHistory')}</Text>
          <TouchableOpacity onPress={toggleHistory}>
            <Image 
              source={require('../assets/back.png')} 
              style={[styles.historyCloseIcon, {tintColor: colors.text}]} 
            />
          </TouchableOpacity>
        </View>
        
        {isLoading && historyPage === 1 ? (
          <FlatList
            data={[1, 2, 3]} // Show 3 skeleton items
            renderItem={renderHistorySkeleton}
            keyExtractor={(item, index) => `skeleton-${index}`}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.historyList}
          />
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, {color: colors.text}]}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => fetchImageHistory(1)}
            >
              <Text style={[styles.retryText, {color: colors.text}]}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : imageHistory.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No images generated yet</Text>
          </View>
        ) : (
          <>
            <FlatList
              data={imageHistory}
              renderItem={renderHistoryItem}
              keyExtractor={item => item.image_id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.historyList}
              onEndReached={loadMoreImages}
              onEndReachedThreshold={0.5}
              ListFooterComponent={
                hasMoreImages ? (
                  <TouchableOpacity 
                    style={styles.viewMoreButton}
                    onPress={loadMoreImages}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color={colors.text} />
                    ) : (
                      <Text style={[styles.viewMoreText, {color: colors.text}]}>View More</Text>
                    )}
                  </TouchableOpacity>
                ) : null
              }
            />
          </>
        )}
      </Animated.View>

      {/* Low Balance Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={lowBalanceModalVisible}
        onRequestClose={() => setLowBalanceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, {backgroundColor: colors.background2}]}>
            <Image 
              source={require('../assets/coin.png')} 
              style={styles.modalCoinImage} 
            />
            <Text style={[styles.modalTitle, {color: colors.text}]}>Insufficient Balance</Text>
            <Text style={[styles.modalMessage, {color: colors.text}]}>
              You need {requiredCoins} coins to generate this image.
              Your current balance is {coinCount} coins.
            </Text>
            <View style={styles.modalButtonsContainer}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setLowBalanceModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.rechargeButton]} 
                onPress={navigateToSubscription}
              >
                <Text style={styles.rechargeButtonText}>Recharge Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Full Screen Image Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={fullScreenModalVisible}
        onRequestClose={closeFullScreenModal}
      >
        <View style={styles.fullScreenModalOverlay}>
          <View style={styles.fullScreenModalContainer}>
            {/* Header with close button */}
            <View style={styles.fullScreenHeader}>
              <TouchableOpacity 
                style={styles.fullScreenCloseButton}
                onPress={closeFullScreenModal}
              >
                <MaterialIcons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
            
            {/* Full screen image */}
            <View style={styles.fullScreenImageContainer}>
              <Image 
                source={{ uri: fullScreenImageUrl }} 
                style={styles.fullScreenImage}
                resizeMode="contain"
              />
            </View>
            
            {/* Display prompt text */}
            {fullScreenPromptText ? (
              <View style={styles.fullScreenPromptContainer}>
                <Text style={styles.fullScreenPromptText}>{fullScreenPromptText}</Text>
              </View>
            ) : null}
            
            {/* Action buttons */}
            <View style={styles.fullScreenActions}>
              <TouchableOpacity 
                style={styles.fullScreenActionButton}
                onPress={() => handleDownloadImage(fullScreenImageUrl, fullScreenImageId)}
                disabled={downloadingImageId === fullScreenImageId}
              >
                {downloadingImageId === fullScreenImageId ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <MaterialIcons name="file-download" size={24} color="#fff" />
                )}
                <Text style={styles.fullScreenActionText}>Download</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.fullScreenActionButton}
                onPress={() => handleShareImage(fullScreenImageUrl)}
              >
                <MaterialIcons name="ios-share" size={24} color="#fff" />
                <Text style={styles.fullScreenActionText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingRight: 10,
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  headerTitle:{
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
 
  },
  historyButton: {
    padding: 8,
    borderRadius: 20,
 
  },

  matrixLogoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100, // Space for text input at bottom
  },
  matrixLogo: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
    marginBottom: 20,
  },
  matrixLogoText: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    margin: 10,
    position: 'absolute',
    bottom: 70,
    alignSelf: 'center',
  },
  keyboardAvoidView: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
  },
  textInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '90%',
    alignSelf: 'center',
    backgroundColor: '#F9F9F9',
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  attachedImageContainer: {
    width: '90%',
    alignSelf: 'center',
    marginBottom: 10,
  },
  imageCounterContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  imageCounterText: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.7,
  },
  attachedImageWrapper: {
    width: 120,
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    marginRight: 10,
  },
  attachedImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeImageButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  uploadingText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 5,
  },
  attachButton: {
    padding: 8,
    marginRight: 5,
  },
  attachIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
    tintColor:'#fff',
  },
  attachButtonCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 0,
    shadowColor: '#007BFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  attachButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
  },
  sendButton: {
    backgroundColor: '#007BFF',
    padding: 10,
    borderRadius: 25,
    marginLeft: 0,
  },
  sendButtonDisabled: {
    backgroundColor: '#E0E0E0',
    opacity: 0.6,
  },
  sendIcon: {
    width: 20,
    height: 20,
    tintColor: '#FFFFFF',
    resizeMode: 'contain',
  },
  horizontalContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    width: 16,
    height: 16,
    tintColor:'#fff',
    marginLeft:10,
  },
  icon2: {
    width: 16,
    height: 16,
    tintColor:'#333',
    marginRight: 5,
  },
  generateContent: {
    alignItems: 'center',
  },
  generateText: {
    fontSize: 16,
    color: '#fff',
  },
  coinIcon: {
    width: 12,
    height: 12,
    marginTop: 2,
  },
  coinText: {
    fontSize: 12,
    color: '#fff',
    marginTop: 2,
  },
  headerIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  tryAgainButton: {
    backgroundColor: '#E0E0E0',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginHorizontal: 10,
  },
  tryAgainText: {
    color: '#000000',
    fontSize: 16,
  },
  generateButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  // Removed generateButton2 style
  // History panel styles
  historyPanel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '70%',
    height: '100%',
    backgroundColor: '#1E1E2E',
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    marginTop: 40,
  },
  historyTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  historyCloseIcon: {
    width: 24,
    height: 24,
    transform: [{rotate: '180deg'}],
  },
  historyList: {
    padding: 15,
  },
  historyItem: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 15,
  },
  historyImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  historyItemContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  historyDate: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  historyPrompt: {
    color: '#fff',
    fontSize: 14,
    marginVertical: 4,
  },
  historyActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 5,
  },
  historyActionButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 8,
    borderRadius: 20,
    marginLeft: 8,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyActionIcon: {
    width: 16,
    height: 16,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loaderText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ff6b6b',
    marginBottom: 15,
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#007BFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    textAlign: 'center',
  },
  viewMoreButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 15,
  },
  viewMoreText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalCoinImage: {
    width: 60,
    height: 60,
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  modalMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#E0E0E0',
  },
  rechargeButton: {
    backgroundColor: '#007BFF',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: '500',
  },
  rechargeButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  // Full Screen Modal Styles
  fullScreenModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenModalContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  fullScreenHeader: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1000,
  },
  fullScreenCloseButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
  },
  fullScreenImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
  fullScreenActions: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  fullScreenActionButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    minWidth: 100,
  },
  fullScreenActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  fullScreenPromptContainer: {
    padding: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 8,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  fullScreenPromptText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
  historyImageContainer: {
    borderRadius: 8,
  },
  // Image Templates Styles
  templatesContainer: {
    padding: 15,
    marginVertical: -20,
  },
  templatesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: -550,
    textAlign: 'left',
    paddingLeft: 5,
  },
  templatesScrollContainer: {
    height: 200, // Fixed height for the scroll container
  },
  templatesScrollContent: {
    paddingLeft: 5,
    paddingRight: 5,
    alignItems: 'center',
  },
  templatesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  templateItem: {
    marginBottom: 10,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  templateImage: {
    resizeMode: 'cover',
  },
  templateOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 12,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  templateText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'left',
    color: '#ffffff',
    lineHeight: 16,
  },
  fullScreenGridContainer: {
    flex: 1,
    paddingHorizontal: 2,
    paddingTop: 2,
    paddingBottom: 100, // Space for text input at bottom
  },
  gridContentContainer: {
    paddingBottom: 20,
  },
  gridImageTemplateItem: {
    width: (width - 6) / 2, // 2 columns with minimal spacing
    aspectRatio: 0.75,
    borderRadius: 0, // Remove rounded edges
    margin: 1, // Minimal gap
    overflow: 'hidden',
  },
  gridImageTemplateContainer: {
    flex: 1,
    position: 'relative',
    borderRadius: 0, // Remove rounded edges
    overflow: 'hidden',
  },
  gridImageTemplate: {
    width: '100%',
    height: '100%',
  },
  gridImageTemplateOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 8,
  },
  makeImageButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backdropFilter: 'blur(10px)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  makeImageButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  skeletonItem: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(200, 200, 200, 0.2)',
  },
  skeletonImage: {
    backgroundColor: 'rgba(200, 200, 200, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  skeletonText: {
    height: 12,
    backgroundColor: 'rgba(200, 200, 200, 0.3)',
    borderRadius: 6,
    width: '80%',
  },
});

export default ImageGenerateScreen;
