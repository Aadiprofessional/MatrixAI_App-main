import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import RNFS from 'react-native-fs';
import { WebView } from 'react-native-webview';
import Share from 'react-native-share';
import FileViewerBottomSheet from './FileViewerBottomSheet';

const AttachmentComponent = ({ url, filename, fileType, colors }) => {
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Extract file extension from URL or filename
  const getFileExtension = () => {
    if (fileType) return fileType;
    if (filename) {
      const ext = filename.split('.').pop()?.toLowerCase();
      return ext;
    }
    if (url) {
      const ext = url.split('.').pop()?.toLowerCase().split('?')[0];
      return ext;
    }
    return 'file';
  };

  // Get file icon based on extension
  const getFileIcon = () => {
    const ext = getFileExtension();
    switch (ext) {
      case 'pdf':
        return 'document-text-outline';
      case 'doc':
      case 'docx':
        return 'document-outline';
      case 'xls':
      case 'xlsx':
        return 'grid-outline';
      case 'ppt':
      case 'pptx':
        return 'easel-outline';
      case 'txt':
        return 'document-text-outline';
      case 'zip':
      case 'rar':
        return 'archive-outline';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return 'image-outline';
      case 'mp4':
      case 'avi':
      case 'mov':
        return 'videocam-outline';
      case 'mp3':
      case 'wav':
        return 'musical-notes-outline';
      default:
        return 'document-outline';
    }
  };

  // Get display filename
  const getDisplayFilename = () => {
    if (filename) return filename;
    if (url) {
      const urlParts = url.split('/');
      const lastPart = urlParts[urlParts.length - 1];
      return lastPart.split('?')[0] || 'document';
    }
    return 'document';
  };

  // Request storage permission for Android
  const requestStoragePermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Storage Permission',
            message: 'App needs access to storage to download files',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  // Handle file download
  const handleDownload = async () => {
    if (!url) {
      Alert.alert('Error', 'No download URL available');
      return;
    }

    // Request permission first
    const hasPermission = await requestStoragePermission();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Storage permission is required to download files');
      return;
    }

    setIsDownloading(true);
    try {
      const displayName = getDisplayFilename();
      const downloadPath = Platform.OS === 'ios' 
        ? RNFS.DocumentDirectoryPath + '/' + displayName
        : RNFS.DownloadDirectoryPath + '/' + displayName;

      // Download the file
      const downloadResult = await RNFS.downloadFile({
        fromUrl: url,
        toFile: downloadPath,
      }).promise;
      
      if (downloadResult.statusCode === 200) {
        // Share the downloaded file
        const shareOptions = {
          title: 'Share File',
          url: Platform.OS === 'ios' ? downloadPath : 'file://' + downloadPath,
          type: 'application/octet-stream',
        };
        
        try {
          await Share.open(shareOptions);
        } catch (shareError) {
          if (shareError.message !== 'User did not share') {
            Alert.alert('Success', `File downloaded to: ${downloadPath}`);
          }
        }
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Error', 'Failed to download file. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Handle file preview
  const handlePreview = () => {
    if (!url) {
      Alert.alert('Error', 'No preview URL available');
      return;
    }

    const ext = getFileExtension();
    
    // For supported file types, show custom viewer
    if (['pdf', 'doc', 'docx', 'xls', 'xlsx'].includes(ext)) {
      setIsPreviewVisible(true);
    } else {
      // For other files, try to open with system default app
      Linking.openURL(url).catch(() => {
        Alert.alert('Error', 'Cannot preview this file type');
      });
    }
  };



  return (
    <View style={[
      styles.container, 
      { 
        backgroundColor: colors?.surface || colors?.background || '#F8F9FA',
        borderColor: colors?.border || '#E0E0E0' 
      }
    ]}>
      <View style={styles.fileInfo}>
        <View style={[styles.iconContainer, { backgroundColor: colors?.primary || '#2274F0' }]}>
          <Ionicons 
            name={getFileIcon()} 
            size={24} 
            color="white" 
          />
        </View>
        <View style={styles.fileDetails}>
          <Text style={[styles.filename, { color: colors?.text || '#333' }]} numberOfLines={2}>
            {getDisplayFilename()}
          </Text>
          <Text style={[styles.fileType, { color: colors?.textSecondary || '#666' }]}>
            {getFileExtension().toUpperCase()} File
          </Text>
        </View>
      </View>
      
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.previewButton, { backgroundColor: colors?.primary || '#2274F0' }]}
          onPress={handlePreview}
          disabled={isDownloading}
        >
          <Ionicons name="eye-outline" size={16} color="white" />
          <Text style={styles.actionButtonText}>Preview</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.downloadButton, { borderColor: colors?.primary || '#2274F0' }]}
          onPress={handleDownload}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <ActivityIndicator size="small" color={colors?.primary || '#2274F0'} />
          ) : (
            <Ionicons name="download-outline" size={16} color={colors?.primary || '#2274F0'} />
          )}
          <Text style={[styles.actionButtonText, { color: colors?.primary || '#2274F0' }]}>
            {isDownloading ? 'Downloading...' : 'Download'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Preview Bottom Sheet */}
       <FileViewerBottomSheet
         visible={isPreviewVisible}
         url={url}
         fileType={getFileExtension()}
         filename={filename}
         colors={colors}
         onClose={() => setIsPreviewVisible(false)}
       />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginVertical: 8,
    maxWidth: 300,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fileDetails: {
    flex: 1,
  },
  filename: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  fileType: {
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  previewButton: {
    // backgroundColor set dynamically
  },
  downloadButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
});

export default AttachmentComponent;