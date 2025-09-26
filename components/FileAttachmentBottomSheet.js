import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  Modal,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import DocumentPicker from 'react-native-document-picker';
import { validateFile } from '../utils/fileUploadUtils';

const { height: screenHeight } = Dimensions.get('window');

const FileAttachmentBottomSheet = ({ 
  visible, 
  onClose, 
  onFileSelected,
  colors = {
    background: '#fff',
    text: '#000',
    textSecondary: '#666',
    primary: '#4C8EF7',
    border: '#e0e0e0'
  }
}) => {

  const handleCameraPress = () => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1920,
      maxHeight: 1920,
    };

    launchCamera(options, (response) => {
      if (response.didCancel || response.errorMessage) {
        return;
      }

      if (response.assets && response.assets[0]) {
        const file = {
          uri: response.assets[0].uri,
          name: response.assets[0].fileName || `camera_${Date.now()}.jpg`,
          type: response.assets[0].type,
          size: response.assets[0].fileSize,
        };

        const validation = validateFile(file);
        if (!validation.isValid) {
          Alert.alert('Invalid File', validation.error);
          return;
        }

        onFileSelected(file, validation.fileType);
        onClose();
      }
    });
  };

  const handleGalleryPress = () => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1920,
      maxHeight: 1920,
      selectionLimit: 1,
    };

    launchImageLibrary(options, (response) => {
      if (response.didCancel || response.errorMessage) {
        return;
      }

      if (response.assets && response.assets[0]) {
        const file = {
          uri: response.assets[0].uri,
          name: response.assets[0].fileName || `gallery_${Date.now()}.jpg`,
          type: response.assets[0].type,
          size: response.assets[0].fileSize,
        };

        const validation = validateFile(file);
        if (!validation.isValid) {
          Alert.alert('Invalid File', validation.error);
          return;
        }

        onFileSelected(file, validation.fileType);
        onClose();
      }
    });
  };

  const handleDocumentPress = async () => {
    try {
      const result = await DocumentPicker.pick({
        type: [
          DocumentPicker.types.pdf,
          DocumentPicker.types.doc,
          DocumentPicker.types.docx,
          DocumentPicker.types.xls,
          DocumentPicker.types.xlsx,
          DocumentPicker.types.plainText,
          'text/csv',
          'application/json',
        ],
        allowMultiSelection: false,
      });

      if (result && result[0]) {
        const file = {
          uri: result[0].uri,
          name: result[0].name,
          type: result[0].type,
          size: result[0].size,
        };

        const validation = validateFile(file);
        if (!validation.isValid) {
          Alert.alert('Invalid File', validation.error);
          return;
        }

        onFileSelected(file, validation.fileType);
        onClose();
      }
    } catch (error) {
      if (DocumentPicker.isCancel(error)) {
        // User cancelled the picker
        return;
      }
      console.error('Document picker error:', error);
      Alert.alert('Error', 'Failed to select document');
    }
  };

  const attachmentOptions = [
    {
      id: 'camera',
      title: 'Camera',
      subtitle: 'Take a photo',
      icon: 'camera-alt',
      iconLibrary: 'MaterialIcons',
      color: '#4CAF50',
      onPress: handleCameraPress,
    },
    {
      id: 'gallery',
      title: 'Photo & Video',
      subtitle: 'Choose from gallery',
      icon: 'photo-library',
      iconLibrary: 'MaterialIcons',
      color: '#FF9800',
      onPress: handleGalleryPress,
    },
    {
      id: 'document',
      title: 'Document',
      subtitle: 'PDF, Word, Excel files',
      icon: 'file-document',
      iconLibrary: 'MaterialCommunityIcons',
      color: '#2196F3',
      onPress: handleDocumentPress,
    },
  ];

  const renderAttachmentOption = (option) => {
    const IconComponent = option.iconLibrary === 'MaterialCommunityIcons' 
      ? MaterialCommunityIcons 
      : Icon;

    return (
      <TouchableOpacity
        key={option.id}
        style={[styles.optionButton, { borderColor: colors.border }]}
        onPress={option.onPress}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, { backgroundColor: option.color }]}>
          <IconComponent 
            name={option.icon} 
            size={24} 
            color="#fff" 
          />
        </View>
        <View style={styles.optionContent}>
          <Text style={[styles.optionTitle, { color: colors.text }]}>
            {option.title}
          </Text>
          <Text style={[styles.optionSubtitle, { color: colors.textSecondary }]}>
            {option.subtitle}
          </Text>
        </View>
        <Icon 
          name="chevron-right" 
          size={24} 
          color={colors.textSecondary} 
        />
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.overlayTouchable} 
          activeOpacity={1} 
          onPress={onClose}
        />
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.dragHandle} />
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Attach File
            </Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={onClose}
            >
              <Icon name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              Choose attachment type
            </Text>
            
            <View style={styles.optionsContainer}>
              {attachmentOptions.map(renderAttachmentOption)}
            </View>

            {/* File type info */}
            <View style={[styles.infoContainer, { backgroundColor: colors.border + '20' }]}>
              <Icon name="info-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                Images: JPG, PNG, GIF, WebP (max 5MB){'\n'}
                Documents: PDF, DOC, DOCX, XLS, XLSX, TXT, CSV (max 10MB)
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  overlayTouchable: {
    flex: 1,
  },
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: screenHeight * 0.6,
    minHeight: screenHeight * 0.4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    position: 'relative',
  },
  dragHandle: {
    position: 'absolute',
    top: 8,
    left: '50%',
    marginLeft: -20,
    width: 40,
    height: 4,
    backgroundColor: '#ccc',
    borderRadius: 2,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#fff',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 14,
    fontWeight: '400',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  infoText: {
    fontSize: 12,
    lineHeight: 16,
    marginLeft: 8,
    flex: 1,
  },
});

export default FileAttachmentBottomSheet;