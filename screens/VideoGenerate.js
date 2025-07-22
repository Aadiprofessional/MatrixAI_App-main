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
import { supabase } from '../supabaseClient';
import RNFS from 'react-native-fs';
import LottieView from 'lottie-react-native';
import { VIDEO_SERVICE_UID } from '@env';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuthUser } from '../hooks/useAuthUser';
import { useCoinsSubscription } from '../hooks/useCoinsSubscription';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import Share from 'react-native-share';
import Toast from 'react-native-toast-message';
import { PERMISSIONS, request, RESULTS } from 'react-native-permissions';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import Video from 'react-native-video';
import { videoService } from '../services/videoService';

const { width, height } = Dimensions.get('window');

const VideoGenerateScreen = () => {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  const { t } = useLanguage();
  const [userText, setUserText] = useState('');
  const [isFinished, setIsFinished] = useState(false);
  const [transcription, setTranscription] = useState(
    t('startWritingToGenerateVideos')
  );
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  
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
  
  // Video-specific state
  const [videoHistory, setVideoHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [hasMoreVideos, setHasMoreVideos] = useState(false);
  const videosPerPage = 10;
  const [downloadingVideoId, setDownloadingVideoId] = useState(null);
  
  // Video preview modal state
  const [videoPreviewModalVisible, setVideoPreviewModalVisible] = useState(false);
  const [previewVideoUrl, setPreviewVideoUrl] = useState(null);
  const [previewVideoTitle, setPreviewVideoTitle] = useState('');
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [isDownloadingPreview, setIsDownloadingPreview] = useState(false);
  const [localVideoPath, setLocalVideoPath] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const videoRef = useRef(null);
  
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

    // Cleanup function to remove temporary files on unmount
    return () => {
      if (localVideoPath) {
        const filePath = localVideoPath.replace('file://', '');
        RNFS.exists(filePath).then(exists => {
          if (exists) {
            RNFS.unlink(filePath).catch(error => {
              console.log('Could not clean up video file on unmount:', error);
            });
          }
        });
      }
    };
  }, [fadeAnim, scaleAnim, sendRotation, localVideoPath]);
  
  // Fetch video history when history panel is opened
  useEffect(() => {
    if (historyOpen) {
      fetchVideoHistory(1);
    }
  }, [historyOpen]);

  const fetchVideoHistory = async (page = 1) => {
    // Use a working UID instead of the user's UID
    const workingUid = VIDEO_SERVICE_UID || '0a147ebe-af99-481b-bcaf-ae70c9aeb8d8';
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Use enhanced video service to get all videos with more details
      const result = await videoService.getAllVideosEnhanced({
        uid: workingUid
      });
      
      console.log('Video history result:', result);
      
      // Process videos to ensure they have all required properties
      const processedVideos = (result.videos || []).map(video => ({
        ...video,
        // Ensure these properties exist for UI rendering
        videoId: video.videoId || video.video_id,
        promptText: video.promptText || video.prompt_text || 'Video prompt',
        size: video.size || '1280*720',
        isReady: video.isReady || video.taskStatus === 'completed' || video.task_status === 'completed' || video.task_status === 'SUCCEEDED',
        statusDisplay: video.statusDisplay || 
          (video.isReady || video.task_status === 'SUCCEEDED' ? 'Ready' : 
           video.task_status === 'PROCESSING' ? 'Processing' : 
           video.task_status === 'FAILED' ? 'Failed' : 
           video.task_status || 'Processing'),
        ageDisplay: video.ageDisplay || 'Just now',
        videoUrl: video.videoUrl || video.video_url
      }));
      
      console.log('Processed videos:', processedVideos);
      
      if (page === 1) {
        setVideoHistory(processedVideos);
      } else {
        setVideoHistory(prev => [...prev, ...processedVideos]);
      }
      
      setHistoryPage(page);
      setHasMoreVideos(processedVideos.length >= videosPerPage);
    } catch (err) {
      console.error('Error fetching video history:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreVideos = () => {
    if (!isLoading && hasMoreVideos) {
      fetchVideoHistory(historyPage + 1);
    }
  };
  
  const handleRemoveVideo = async (videoId) => {
    if (!videoId) return;
    
    // Use a working UID instead of the user's UID
    const workingUid = VIDEO_SERVICE_UID || '0a147ebe-af99-481b-bcaf-ae70c9aeb8d8';
    
    try {
      Alert.alert(
        t('removeVideo'),
        t('removeVideoConfirmation'),
        [
          {
            text: t('cancel'),
            style: "cancel"
          },
          {
            text: t('remove'),
            onPress: async () => {
              setIsLoading(true);
              // Use videoService to remove video
              await videoService.removeVideo({
                uid: workingUid,
                videoId: videoId
              });
              
              // Remove the video from the local state
              setVideoHistory(prev => prev.filter(video => video.videoId !== videoId));
              setIsLoading(false);
            }
          }
        ]
      );
    } catch (err) {
      console.error('Error removing video:', err);
      Alert.alert(t('error'), t('failedToRemoveVideo'));
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
      setSelectedImage(null); // Hide the attached image when send button is pressed
      // Keep the uploadedImageUrl for API call but hide the UI
    }
  };
  
  const handleAttachImage = async () => {
    const options = {
      mediaType: 'photo',
      quality: 0.7, // Reduced quality to decrease file size
      includeBase64: true,
      maxWidth: 1280, // Limit image width
      maxHeight: 720, // Limit image height
    };

    try {
      const result = await launchImageLibrary(options);
      if (result.assets && result.assets[0]) {
        const asset = result.assets[0];
        // Store the entire asset object instead of just the URI
        setSelectedImage(asset);
        
        // Log detailed information about the selected image
        console.log('Selected image file:', asset.fileName, asset.type, asset.fileSize);
        
        // Check if the image is in HEIC format and warn the user
        const fileExt = asset.uri.substring(asset.uri.lastIndexOf('.') + 1).toLowerCase();
        if (fileExt === 'heic' || fileExt === 'heif') {
          console.log('HEIC image detected, will convert to JPEG');
          // We'll continue with upload but inform the user
          Toast.show({
            type: 'info',
            text1: 'Converting image format',
            text2: 'HEIC images will be converted to JPEG for better compatibility',
            position: 'bottom',
            visibilityTime: 4000,
          });
        }
        
        // Check if the image is too large (over 5MB)
        if (asset.fileSize > 5 * 1024 * 1024) {
          console.log('Large image detected:', asset.fileSize, 'bytes');
          Toast.show({
            type: 'warning',
            text1: 'Large image detected',
            text2: 'Large images may take longer to process',
            position: 'bottom',
            visibilityTime: 4000,
          });
        }
        
        uploadImageToSupabase(asset);
      }
    } catch (error) {
      console.error('Error picking image:', error.message || error);
      Alert.alert('Error', 'Failed to pick image: ' + (error.message || 'Unknown error'));
    }
  };
  
  const uploadImageToSupabase = async (asset) => {
    try {
      setIsUploading(true);
      
      // Get file extension from uri
      const fileExt = asset.uri.substring(asset.uri.lastIndexOf('.') + 1).toLowerCase();
      
      // Check if the image is in HEIC format and needs conversion
      let imageUri = asset.uri;
      let contentType = asset.type || 'image/jpeg';
      let finalFileExt = fileExt;
      
      // For iOS, we need to handle the file:// protocol
      if (Platform.OS === 'ios' && !imageUri.startsWith('file://')) {
        imageUri = `file://${imageUri}`;
      }
      
      // Convert HEIC images to JPEG format
      if (fileExt === 'heic' || fileExt === 'heif') {
        console.log('Converting HEIC image to JPEG format...');
        try {
          // Import the image resizer library
          const ImageResizer = require('@bam.tech/react-native-image-resizer').default;
          
          // Resize and convert the image to JPEG
          const response = await ImageResizer.createResizedImage(
            imageUri,
            1280, // width
            720,  // height
            'JPEG', // format
            80,    // quality
            0,     // rotation
            null,  // outputPath
            false  // keepMeta
          );
          
          // Update the image URI and content type
          imageUri = response.uri;
          contentType = 'image/jpeg';
          finalFileExt = 'jpg';
          console.log('HEIC image converted to JPEG:', response.uri);
        } catch (conversionError) {
          console.error('Error converting HEIC image:', conversionError);
          throw new Error('Failed to convert HEIC image to JPEG format. Please try a different image.');
        }
      }
      
      // Create file name with correct extension
      const filePath = `user-uploads/${Date.now()}.${finalFileExt}`;
      
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
          contentType: contentType,
          cacheControl: '3600'
        });
      
      console.log('Uploaded file with content type:', contentType);

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('user-uploads')
        .getPublicUrl(filePath);

      console.log('Upload successful, public URL:', publicUrl);
      setUploadedImageUrl(publicUrl);
    } catch (error) {
      console.error('Error uploading image:', error.message || error);
      
      // Provide more specific error messages based on the error type
      if (error.message && error.message.includes('HEIC')) {
        Alert.alert(
          'Image Format Error', 
          'HEIC image format could not be processed. The image has been converted to JPEG but still failed. Please try a different image.'
        );
      } else if (error.message && error.message.includes('timed out')) {
        Alert.alert(
          'Upload Timeout', 
          'The image upload timed out. This may be due to a large file size or slow connection. Please try a smaller image or check your connection.'
        );
      } else {
        Alert.alert('Error', 'Failed to upload image: ' + (error.message || 'Unknown error'));
      }
      
      setSelectedImage(null);
      setUploadedImageUrl(null);
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleRemoveAttachedImage = () => {
    setSelectedImage(null);
    setUploadedImageUrl(null);
  };

  const handleTryAgain = () => {
    setIsFinished(false); // Reset to show the input box again
    setUserText(''); // Clear the text input
    setTranscription(
      t('startWritingToGenerateVideos')
    );
  };

  const handleGenerate = (existingPrompt) => {
    // Check if user has enough coins (25) for Video Generate
    if (coinCount >= 25) {
      // If an existing prompt was provided, use it for navigation
      const promptToUse = existingPrompt || userText;
      // Clone the message to avoid passing a synthetic event
      const messageToPass = (promptToUse || transcription) + "";
      
      // Validate the image URL if one exists
      let imageUrlToPass = null;
      let hasValidImage = false;
      
      if (uploadedImageUrl) {
        if (typeof uploadedImageUrl === 'string' && uploadedImageUrl.trim()) {
          imageUrlToPass = uploadedImageUrl.trim();
          hasValidImage = true;
          
          // Check if the URL contains 'heic' which might cause issues
          if (imageUrlToPass.toLowerCase().includes('.heic')) {
            console.warn('HEIC image URL detected in final URL:', imageUrlToPass);
            // We'll still try to use it since we should have converted it earlier
          }
          
          // Validate that the URL is properly formed
          try {
            new URL(imageUrlToPass);
          } catch (error) {
            console.error('Invalid image URL format:', error);
            Toast.show({
              type: 'error',
              text1: 'Invalid Image URL',
              text2: 'The image URL format is invalid. Please try attaching the image again.',
              position: 'bottom',
            });
            return; // Don't proceed with invalid URL
          }
        } else {
          console.error('Invalid uploadedImageUrl:', uploadedImageUrl);
          Toast.show({
            type: 'error',
            text1: 'Image Error',
            text2: 'There was a problem with the attached image. Please try again.',
            position: 'bottom',
          });
          return; // Don't proceed with invalid image
        }
      }
      
      console.log('Generating video with:', {
        message: messageToPass,
        imageUrl: imageUrlToPass,
        hasImage: hasValidImage
      });
      
      navigation.navigate('CreateVideoScreen', { 
        message: messageToPass,
        imageUrl: imageUrlToPass // Pass the validated image URL if available
      });
    } else {
      setRequiredCoins(25);
      setLowBalanceModalVisible(true);
    }
  };

  const navigateToSubscription = () => {
    setLowBalanceModalVisible(false);
    navigation.navigate('SubscriptionScreen');
  };

  const handleDownloadVideo = async (videoUrl, videoId) => {
    try {
      // Check if videoUrl is valid
      if (!videoUrl) {
        Toast.show({
          type: 'error',
          text1: t('downloadFailed'),
          text2: t('videoUrlMissing'),
          position: 'bottom',
        });
        return;
      }
      
      // Set downloading state
      setDownloadingVideoId(videoId);
      
      console.log('Starting video download for URL:', videoUrl);
      
      // Request storage permission (for Android)
      if (Platform.OS === 'android') {
        const permission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: t('storagePermission'),
            message: t('storagePermissionMessage'),
            buttonNeutral: t('askMeLater'),
            buttonNegative: t('cancel'),
            buttonPositive: t('ok'),
          },
        );
        
        if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
          Toast.show({
            type: 'error',
            text1: t('permissionDenied'),
            text2: t('cannotSaveWithoutStoragePermission'),
            position: 'bottom',
          });
          setDownloadingVideoId(null);
          return;
        }
      } else if (Platform.OS === 'ios') {
        // For iOS, request photo library permission (same as image download)
        const permission = await request(PERMISSIONS.IOS.PHOTO_LIBRARY);
        if (permission !== RESULTS.GRANTED) {
          Toast.show({
            type: 'error',
            text1: t('permissionDenied'),
            text2: t('cannotSaveWithoutPhotoLibraryPermission'),
            position: 'bottom',
          });
          setDownloadingVideoId(null);
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
      
      // Show toast notification that download has started
      Toast.show({
        type: 'info',
        text1: t('downloadStarted'),
        text2: t('videoDownloading'),
        position: 'bottom',
      });
      
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
            text1: t('downloadComplete'),
            text2: t('videoSavedToGallery'),
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
              text1: t('downloadComplete'),
              text2: t('videoSavedToPhotos'),
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
              text1: t('downloadComplete'),
              text2: t('videoDownloadedButNotSaved'),
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
        text1: t('downloadFailed'),
        text2: t('couldNotSaveVideo'),
        position: 'bottom',
      });
    } finally {
      setDownloadingVideoId(null);
    }
  };
  
  const handleShareVideo = async (videoUrl) => {
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
          title: t('shareVideo'),
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

  const handleVideoPreview = async (videoUrl, promptText) => {
    try {
      // Check if videoUrl is valid
      if (!videoUrl) {
        Toast.show({
          type: 'error',
          text1: t('previewFailed'),
          text2: t('videoUrlMissing'),
          position: 'bottom',
        });
        return;
      }
      
      // Set up the preview modal and state
      setPreviewVideoUrl(videoUrl); // Store original URL for retry
      setPreviewVideoTitle(promptText || t('videoPreview'));
      setVideoPreviewModalVisible(true);
      setIsDownloadingPreview(true);
      setDownloadProgress(0);
      setLocalVideoPath(null);
      setIsPreviewPlaying(false);

      // Create a unique filename for the video
      const filename = videoUrl.substring(videoUrl.lastIndexOf('/') + 1);
      const extension = filename.split('.').pop() || 'mp4';
      const tempFilename = `preview_video_${Date.now()}.${extension}`;
      const tempFilePath = `${RNFS.CachesDirectoryPath}/${tempFilename}`;

      console.log('Downloading video for preview:', videoUrl);
      console.log('Saving to:', tempFilePath);

      // Download the video with progress tracking
      const download = RNFS.downloadFile({
        fromUrl: videoUrl,
        toFile: tempFilePath,
        background: false,
        discretionary: false,
        progressDivider: 5, // More frequent updates
        begin: (res) => {
          console.log('Preview download started, total size:', res.contentLength);
        },
        progress: (res) => {
          if (res.contentLength > 0) {
            const progressPercent = (res.bytesWritten / res.contentLength) * 100;
            setDownloadProgress(Math.round(progressPercent));
            console.log(`Preview download progress: ${progressPercent.toFixed(2)}%`);
          } else {
            // If content length is unknown, show indeterminate progress
            setDownloadProgress(50);
          }
        }
      });

      // Wait for download to complete
      const result = await download.promise;
      console.log('Preview download result:', result);

      if (result.statusCode === 200) {
        // Verify file exists and has content
        const fileExists = await RNFS.exists(tempFilePath);
        if (fileExists) {
          const fileStats = await RNFS.stat(tempFilePath);
          if (fileStats.size > 0) {
            setLocalVideoPath(`file://${tempFilePath}`);
            setIsDownloadingPreview(false);
            setIsPreviewPlaying(true);
            console.log('Video ready for preview:', `file://${tempFilePath}`);
          } else {
            throw new Error('Downloaded file is empty');
          }
        } else {
          throw new Error('Downloaded file not found');
        }
      } else {
        throw new Error(`Download failed with status code: ${result.statusCode}`);
      }
    } catch (error) {
      console.error('Error downloading video for preview:', error);
      setIsDownloadingPreview(false);
      Toast.show({
        type: 'error',
        text1: 'Preview Error',
        text2: 'Failed to load video for preview. Please try again.',
        position: 'bottom',
      });
      // Don't close the modal, let user try again or close manually
    }
  };

  const closeVideoPreview = async () => {
    setVideoPreviewModalVisible(false);
    setIsPreviewPlaying(false);
    setIsDownloadingPreview(false);
    setPreviewVideoUrl(null);
    setPreviewVideoTitle('');
    setDownloadProgress(0);
    
    // Clean up the temporary file
    if (localVideoPath) {
      try {
        const filePath = localVideoPath.replace('file://', '');
        const fileExists = await RNFS.exists(filePath);
        if (fileExists) {
          await RNFS.unlink(filePath);
          console.log('Cleaned up preview video file');
        }
      } catch (error) {
        console.log('Could not clean up preview video file:', error);
      }
      setLocalVideoPath(null);
    }
  };

  const togglePreviewPlayback = () => {
    setIsPreviewPlaying(!isPreviewPlaying);
  };

  const handlePreviewVideoEnd = () => {
    setIsPreviewPlaying(false);
  };

  const renderHistoryItem = ({ item }) => (
    <View style={[styles.historyItem, {backgroundColor: 'rgba(30,30,46,0.8)'}]}>
      <TouchableOpacity 
        style={[
          styles.videoThumbnail,
          item.isReady && styles.videoThumbnailReady
        ]}
        onPress={() => {
          if (item.isReady) {
            // Clone the values to avoid passing synthetic events
            const videoUrlCopy = item.videoUrl + "";
            const promptTextCopy = item.promptText + "";
            handleVideoPreview(videoUrlCopy, promptTextCopy);
          }
        }}
        disabled={!item.isReady}
        activeOpacity={0.7}
      >
        {/* Enhanced video thumbnail with play button overlay */}
        <View style={styles.thumbnailContainer}>
          {/* Video thumbnail background with gradient overlay */}
          <View style={[styles.thumbnailBackground, {
            backgroundColor: item.isReady ? colors.primary + '33' : 
                           item.statusDisplay === 'Failed' ? '#F44336' + '22' : 
                           colors.text + '22',
            borderRadius: 8,
          }]} />
          
          {/* Play button overlay - more prominent */}
          <View style={styles.playButtonOverlay}>
            <MaterialIcons 
              name={item.isReady ? "play-circle-filled" : item.statusDisplay === 'Failed' ? "error" : "hourglass-empty"} 
              size={50} 
              color={item.isReady ? '#FFFFFF' : item.statusDisplay === 'Failed' ? '#F44336' : colors.text + '77'} 
            />
          </View>
          
          {/* Video resolution - more visible */}
          <Text style={[styles.videoDuration, {color: '#FFFFFF', backgroundColor: 'rgba(0,0,0,0.7)'}]}>
            {item.size || '1280*720'}
          </Text>
          
          {/* Status indicators */}
          {item.isReady && (
            <View style={styles.previewIndicator}>
              <MaterialIcons name="visibility" size={16} color="#FFFFFF" />
            </View>
          )}
          {!item.isReady && item.statusDisplay === 'Processing' && (
            <View style={[styles.previewIndicator, {backgroundColor: '#FF9800'}]}>
              <ActivityIndicator size="small" color="#FFFFFF" />
            </View>
          )}
          {item.statusDisplay === 'Failed' && (
            <View style={[styles.previewIndicator, {backgroundColor: '#F44336'}]}>
              <MaterialIcons name="error-outline" size={16} color="#FFFFFF" />
            </View>
          )}
        </View>
      </TouchableOpacity>
      
      <View style={[styles.historyItemContent, {backgroundColor: 'transparent'}]}>
        {/* Enhanced video metadata section */}
        <View style={styles.videoMetadata}>
          <Text style={[styles.historyDate, {color: '#FFFFFF'}]}>
            {item.ageDisplay || 'Just now'}
          </Text>
          <Text style={[styles.videoStatus, {
            color: item.isReady ? '#4CAF50' : 
                  item.statusDisplay === 'Failed' ? '#F44336' : 
                  '#FF9800',
            fontWeight: 'bold',
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 10,
            backgroundColor: item.isReady ? 'rgba(76,175,80,0.1)' : 
                           item.statusDisplay === 'Failed' ? 'rgba(244,67,54,0.1)' : 
                           'rgba(255,152,0,0.1)',
          }]}>
            {item.statusDisplay || (item.isReady ? 'Ready' : item.task_status === 'PROCESSING' ? 'Processing' : item.task_status || 'Processing')}
          </Text>
        </View>
        
        {/* Video prompt text - improved readability */}
        <Text style={[styles.historyPrompt, {color: '#FFFFFF', fontWeight: '500'}]} numberOfLines={2}>
          {item.promptText || 'Video prompt'}
        </Text>
        
        {/* Reorganized action buttons with improved layout */}
        <View style={styles.historyActions}>
          {/* Primary Play button or Retry button */}
          {item.isReady ? (
            <TouchableOpacity 
              style={[styles.historyActionButtonPrimary, {backgroundColor: '#3a7bff'}]}
              onPress={() => {
                // Clone the values to avoid passing synthetic events
                const videoUrlCopy = item.videoUrl + "";
                const promptTextCopy = item.promptText + "";
                handleVideoPreview(videoUrlCopy, promptTextCopy);
              }}
            >
              <MaterialIcons name="play-arrow" size={18} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>{t('play')}</Text>
            </TouchableOpacity>
          ) : item.statusDisplay === 'Failed' && (
            <TouchableOpacity 
              style={[styles.historyActionButtonPrimary, {backgroundColor: '#F44336'}]}
              onPress={() => {
                // Clone the promptText to avoid passing a synthetic event
                const promptTextCopy = item.promptText + "";
                handleGenerate(promptTextCopy);
              }}
            >
              <MaterialIcons name="refresh" size={18} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>{t('retry')}</Text>
            </TouchableOpacity>
          )}
          
          {/* Secondary action buttons in a row with better spacing */}
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, width: '100%'}}>
            <View style={{flexDirection: 'row'}}>
              {/* Download button */}
              {item.isReady && (
                <TouchableOpacity 
                  style={[styles.historyActionButton, {backgroundColor: 'rgba(255,255,255,0.15)', marginRight: 8}]}
                  onPress={() => {
                    // Clone the values to avoid passing synthetic events
                    const videoUrlCopy = item.videoUrl + "";
                    const videoIdCopy = item.videoId + "";
                    handleDownloadVideo(videoUrlCopy, videoIdCopy);
                  }}
                  disabled={downloadingVideoId === item.videoId}
                >
                  {downloadingVideoId === item.videoId ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <MaterialIcons name="file-download" size={20} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              )}
              
              {/* Share button */}
              {item.isReady && (
                <TouchableOpacity 
                  style={[styles.historyActionButton, {backgroundColor: 'rgba(255,255,255,0.15)'}]}
                  onPress={() => {
                    // Clone the value to avoid passing a synthetic event
                    const videoUrlCopy = item.videoUrl + "";
                    handleShareVideo(videoUrlCopy);
                  }}
                >
                  <MaterialIcons name="share" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
            
            {/* Delete button - aligned to the right */}
            <TouchableOpacity 
              style={[styles.historyActionButton, {backgroundColor: 'rgba(255,255,255,0.15)'}]}
              onPress={() => {
                // Clone the value to avoid passing a synthetic event
                const videoIdCopy = item.videoId + "";
                handleRemoveVideo(videoIdCopy);
              }}
            >
              <MaterialIcons name="delete" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
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
            onPress={() => {
              // Call navigation.goBack with no arguments, but ensure we're not passing a synthetic event
              navigation.goBack();
            }}
          >
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, {color: colors.text}]}>{t('matrixAI')}</Text>
          {!isFinished && (
            <TouchableOpacity 
              style={[styles.historyButton, {backgroundColor: colors.primary}]} 
              onPress={() => {
                // Call toggleHistory with no arguments, but ensure we're not passing a synthetic event
                toggleHistory();
              }}
            >
              <MaterialIcons name="history" size={24} color={'#fff'} />
            </TouchableOpacity>
          )}
        </Animated.View>
        
        <Animated.View style={[styles.placeholderContainer, { opacity: fadeAnim }]}>
          <Image   
            source={require('../assets/matrix.png')}
            style={[styles.placeholderImage, {tintColor: colors.text}]}
          />
          <Text style={[styles.placeholderText, {color: colors.text}]}>{t('welcomeToMatrixAI')}</Text>
          <Text style={[styles.placeholderText2, {color: colors.text}]}>{t('whatCanIGenerateForYou')}</Text>
        </Animated.View>
        
        <LottieView 
          source={require('../assets/image2.json')}
          autoPlay
          loop
          style={{width: '100%', height: 100, backgroundColor: 'transparent'}}
        />

        {/* Buttons */}
        {isFinished && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.generateButton, { backgroundColor: colors.primary }]} 
              onPress={() => {
                // Call handleGenerate with no arguments, but ensure we're not passing a synthetic event
                handleGenerate();
              }}
            >
              <View style={styles.horizontalContent}>
                <View style={styles.generateContent}>
                  <Text style={styles.generateText}>{t('generateVideo')}</Text>
                  <View style={styles.horizontalContent}>
                    <Text style={styles.coinText}>-25</Text>
                    <Image source={require('../assets/coin.png')} style={styles.coinIcon} />
                  </View>
                </View>
                <Image source={require('../assets/send2.png')} style={styles.icon} />
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
        {!isFinished && (
          <>
            {selectedImage && (
              <View style={styles.attachedImageContainer}>
                {isUploading && (
                  <View style={styles.uploadingOverlay}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.uploadingText}>{t('uploadingImage')}...</Text>
                  </View>
                )}
                <Image 
                  source={{ uri: typeof selectedImage === 'string' ? selectedImage : selectedImage.uri }} 
                  style={styles.attachedImage} 
                  resizeMode="cover"
                />
                <TouchableOpacity 
                  style={styles.removeImageButton}
                  onPress={() => {
                    setSelectedImage(null);
                    setUploadedImageUrl(null);
                  }}
                >
                  <MaterialIcons name="close" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.textInputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder={t('typeYourVideoPromptHere')}
                placeholderTextColor="#999999"
                value={userText}
                onChangeText={(text) => {
                  setUserText(text); // Update input
                  setTranscription(text || t('startWritingToGenerateVideos'));
                }}
              />
              <TouchableOpacity 
                style={styles.attachButton}
                onPress={handleAttachImage}
              >
                <MaterialIcons name="attach-file" size={24} color="#999999" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.sendButton} 
                onPress={() => {
                  // Call handleSend with no arguments, but ensure we're not passing a synthetic event
                  handleSend();
                }}
              >
                <Image
                  source={require('../assets/send2.png')}
                  style={[styles.sendIcon, {tintColor: '#FFFFFF'}]}
                />
              </TouchableOpacity>
            </View>
          </>
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
          <TouchableOpacity onPress={() => {
            // Call toggleHistory with no arguments, but ensure we're not passing a synthetic event
            toggleHistory();
          }}>
            <Image 
              source={require('../assets/back.png')} 
              style={[styles.historyCloseIcon, {tintColor: colors.text}]} 
            />
          </TouchableOpacity>
        </View>
        
        {isLoading && historyPage === 1 ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#007BFF" />
            <Text style={styles.loaderText}>{t('loadingYourVideos')}</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, {color: colors.text}]}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => {
                // Call fetchVideoHistory with a fixed argument, not a synthetic event
                fetchVideoHistory(1);
              }}
            >
              <Text style={[styles.retryText, {color: colors.text}]}>{t('retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : videoHistory.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('noVideosGeneratedYet')}</Text>
          </View>
        ) : (
          <>
            <FlatList
              data={videoHistory}
              renderItem={renderHistoryItem}
              keyExtractor={item => item.videoId}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.historyList}
              onEndReached={loadMoreVideos}
              onEndReachedThreshold={0.5}
              ListFooterComponent={
                hasMoreVideos ? (
                  <TouchableOpacity 
                    style={styles.viewMoreButton}
                    onPress={() => {
                      // Call loadMoreVideos with no arguments, but ensure we're not passing a synthetic event
                      loadMoreVideos();
                    }}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color={colors.text} />
                    ) : (
                      <Text style={[styles.viewMoreText, {color: colors.text}]}>{t('viewMore')}</Text>
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
            <Text style={[styles.modalTitle, {color: colors.text}]}>{t('insufficientBalance')}</Text>
            <Text style={[styles.modalMessage, {color: colors.text}]}>
              {t('youNeedCoinsToGenerate', {requiredCoins})}
              {t('yourCurrentBalance', {coinCount})}
            </Text>
            <View style={styles.modalButtonsContainer}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => {
                  // Set modal visibility without passing a synthetic event
                  setLowBalanceModalVisible(false);
                }}
              >
                <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.rechargeButton]} 
                onPress={() => {
                  // Call navigateToSubscription without passing a synthetic event
                  navigateToSubscription();
                }}
              >
                <Text style={styles.rechargeButtonText}>{t('rechargeNow')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Video Preview Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={videoPreviewModalVisible}
        onRequestClose={closeVideoPreview}
        statusBarTranslucent={true}
      >
        <View style={styles.videoPreviewOverlay}>
          <View style={styles.videoPreviewContainer}>
            {/* Modal Header with Title */}
            <View style={styles.videoPreviewHeader}>
              <TouchableOpacity style={styles.videoPreviewBackButton} onPress={() => {
                // Call closeVideoPreview without passing a synthetic event
                closeVideoPreview();
              }}>
                <MaterialIcons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.videoPreviewTitle} numberOfLines={2}>
                {previewVideoTitle}
              </Text>
              <TouchableOpacity style={styles.videoPreviewCloseButton} onPress={() => {
                // Call closeVideoPreview without passing a synthetic event
                closeVideoPreview();
              }}>
                <MaterialIcons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            {/* Video Player Container */}
            <View style={styles.videoPlayerContainer}>
              {isDownloadingPreview ? (
                // Loading State
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#007BFF" />
                  <Text style={styles.loadingText}>{t('preparingVideo')}</Text>
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View 
                        style={[
                          styles.progressFill, 
                          { width: `${downloadProgress}%` }
                        ]} 
                      />
                    </View>
                    <Text style={styles.progressText}>{downloadProgress}%</Text>
                  </View>
                  <Text style={[styles.loadingText, {fontSize: 12, marginTop: 8, opacity: 0.7}]}>
                    Please wait while we prepare your video
                  </Text>
                </View>
              ) : localVideoPath ? (
                // Video Player with Custom Controls
                <View style={styles.videoPlayerWrapper}>
                  <Video
                    ref={videoRef}
                    source={{ uri: localVideoPath }}
                    style={styles.videoPreview}
                    controls={false} // Using custom controls instead
                    paused={!isPreviewPlaying}
                    resizeMode="contain"
                    repeat={true} // Changed to true for better user experience
                    onEnd={handlePreviewVideoEnd}
                    onLoad={(data) => {
                      console.log('Video loaded successfully:', data);
                      setIsPreviewPlaying(true); // Auto-play when loaded
                    }}
                    onError={(error) => {
                      console.error('Video playback error:', error);
                      Toast.show({
                        type: 'error',
                        text1: 'Playback Error',
                        text2: 'Failed to play video. Please try again.',
                        position: 'bottom',
                      });
                    }}
                    onBuffer={({ isBuffering }) => {
                      console.log('Video buffering:', isBuffering);
                      // Show buffering indicator when needed
                      if (isBuffering) {
                        setIsPreviewPlaying(false);
                      }
                    }}
                  />
                  
                  {/* Custom Video Controls Overlay */}
                  <TouchableOpacity 
                    style={styles.videoControlsOverlay}
                    activeOpacity={0.8}
                    onPress={() => {
                      // Call togglePreviewPlayback with no arguments, but ensure we're not passing a synthetic event
                      togglePreviewPlayback();
                    }}
                  >
                    {!isPreviewPlaying && (
                      <View style={styles.playButtonContainer}>
                        <MaterialIcons name="play-circle-filled" size={80} color="rgba(255,255,255,0.8)" />
                      </View>
                    )}
                  </TouchableOpacity>
                  
                  {/* Video Control Bar - Enhanced with labels */}
                  <View style={styles.videoControlBar}>
                    <TouchableOpacity 
                      style={[styles.videoControlButton, {flexDirection: 'row', alignItems: 'center'}]}
                      onPress={() => {
                        // Call togglePreviewPlayback with no arguments, but ensure we're not passing a synthetic event
                        togglePreviewPlayback();
                      }}
                    >
                      <MaterialIcons 
                        name={isPreviewPlaying ? "pause" : "play-arrow"} 
                        size={28} 
                        color="#FFFFFF" 
                      />
                      <Text style={{color: '#FFFFFF', marginLeft: 5, fontSize: 12}}>
                        {isPreviewPlaying ? t('pause') : t('play')}
                      </Text>
                    </TouchableOpacity>
                    
                    {/* Download Button */}
                    <TouchableOpacity 
                      style={[styles.videoControlButton, {flexDirection: 'row', alignItems: 'center'}]}
                      onPress={() => {
                        closeVideoPreview();
                        // Clone the values to avoid passing synthetic events
                        const videoUrlCopy = previewVideoUrl + "";
                        const videoIdCopy = previewVideoUrl.split('/').pop() + "";
                        handleDownloadVideo(videoUrlCopy, videoIdCopy);
                      }}
                    >
                      <MaterialIcons name="file-download" size={24} color="#FFFFFF" />
                      <Text style={{color: '#FFFFFF', marginLeft: 5, fontSize: 12}}>{t('download')}</Text>
                    </TouchableOpacity>
                    
                    {/* Share Button */}
                    <TouchableOpacity 
                      style={[styles.videoControlButton, {flexDirection: 'row', alignItems: 'center'}]}
                      onPress={() => {
                        closeVideoPreview();
                        // Clone the value to avoid passing a synthetic event
                        const videoUrlCopy = previewVideoUrl + "";
                        handleShareVideo(videoUrlCopy);
                      }}
                    >
                      <MaterialIcons name="share" size={24} color="#FFFFFF" />
                      <Text style={{color: '#FFFFFF', marginLeft: 5, fontSize: 12}}>{t('share')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                // Error State
                <View style={styles.errorStateContainer}>
                  <MaterialIcons name="error-outline" size={48} color="#ff6b6b" />
                  <Text style={styles.errorStateText}>{t('failedToLoadVideo')}</Text>
                  <TouchableOpacity 
                    style={styles.retryButton}
                    onPress={() => {
                      // Clone the values to avoid passing synthetic events
                      const videoUrlCopy = previewVideoUrl + "";
                      const titleCopy = previewVideoTitle + "";
                      handleVideoPreview(videoUrlCopy, titleCopy);
                    }}
                  >
                    <Text style={styles.retryButtonText}>{t('tryAgain')}</Text>
                  </TouchableOpacity>
                </View>
              )}
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
  attachedImageContainer: {
    marginHorizontal: 16,
    marginBottom: 10,
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  attachedImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
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
    marginTop: 10,
    fontSize: 14,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  attachButton: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
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
  placeholderContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  placeholderImage: { 
    width: 100,
    height: 100,
    resizeMode: 'contain',
  },
  placeholderText: {
    fontSize: 16,
    color: '#333',
  },
  placeholderText2: {
    fontSize: 14,
    color: '#666',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
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
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
  },
  sendButton: {
    backgroundColor: '#007BFF',
    padding: 10,
    borderRadius: 25,
    marginLeft: 10,
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
    padding: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    overflow: 'hidden',
  },
  videoThumbnail: {
    width: 110,
    height: 110,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    marginRight: 10,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  videoThumbnailReady: {
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  thumbnailContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  thumbnailBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
  },
  playButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  videoDuration: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  historyItemContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    padding: 5,
  },
  videoMetadata: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
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
  videoStatus: {
    fontSize: 12,
    fontWeight: 'bold',
    marginVertical: 2,
  },
  historyActions: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    marginTop: 8,
    width: '100%',
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
  historyActionButtonPrimary: {
    flexDirection: 'row',
    backgroundColor: '#007BFF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  historyActionPrimaryButton: {
    flexDirection: 'row',
    width: 'auto',
    paddingHorizontal: 16,
    backgroundColor: '#3a7bff',
  },
  historyActionButtonText: {
    color: '#fff',
    marginLeft: 5,
    fontSize: 14,
    fontWeight: '500',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  loaderText: {
    color: '#fff',
    marginTop: 15,
    fontSize: 18,
    fontWeight: '600',
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
  videoPreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPreviewContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  videoPreview: {
    width: '100%',
    height: '100%',
  },
  videoPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    position: 'absolute',
    top: 30, // Moved down from top to position header lower
    left: 0,
    right: 0,
    zIndex: 10,
  },
  videoPreviewTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
    marginHorizontal: 10,
    textAlign: 'center',
    top:15,
  },
  videoPreviewBackButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    marginTop: 30, // Added margin to move the back button lower
  },
  videoPreviewCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    marginTop: 30, // Added margin to match the back button
  },
  videoPlayerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  videoPlayerWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  videoControlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  playButtonContainer: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 40,
    marginTop: 30, // Move the button a little lower
  },
  videoControlBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  videoControlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
  },
  videoControlButtonText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  previewIndicator: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 2,
    borderRadius: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  loadingText: {
    color: '#fff',
    marginTop: 15,
    fontSize: 18,
    fontWeight: '600',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    width: '100%',
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    flex: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007BFF',
    borderRadius: 3,
  },
  progressText: {
    color: '#fff',
    marginLeft: 15,
    fontSize: 14,
    fontWeight: 'bold',
    minWidth: 40,
  },
  errorStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorStateText: {
    color: '#ff6b6b',
    marginBottom: 15,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default VideoGenerateScreen;
