import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Linking,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import BottomSheet from './BottomSheet';
import { PDFViewer, DOCXViewer, XLSXViewer } from './FileViewers';

const { height: screenHeight } = Dimensions.get('window');

const FileViewerBottomSheet = ({ 
  visible, 
  onClose, 
  url, 
  fileType, 
  filename,
  colors = {} 
}) => {
  
  const handleOpenFull = async () => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Cannot open this file type externally');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open file externally');
    }
  };
  // Define snap points for different file types
  const getSnapPoints = () => {
    const minHeight = screenHeight * 0.3; // 30% of screen
    const maxHeight = screenHeight * 0.9; // 90% of screen
    
    switch (fileType?.toLowerCase()) {
      case 'pdf':
        return [minHeight, maxHeight];
      case 'docx':
      case 'doc':
        return [screenHeight * 0.4, maxHeight]; // Start a bit higher for documents
      case 'xlsx':
      case 'xls':
        return [screenHeight * 0.5, maxHeight]; // Start higher for spreadsheets
      default:
        return [minHeight, maxHeight];
    }
  };

  const getInitialSnapIndex = () => {
    // Start at the larger size for better UX
    return 1;
  };

  const renderFileViewer = () => {
    const viewerProps = {
      url,
      colors,
      onClose, // This will be handled by the bottom sheet
    };

    switch (fileType?.toLowerCase()) {
      case 'pdf':
        return <PDFViewer {...viewerProps} />;
      case 'docx':
      case 'doc':
        return <DOCXViewer {...viewerProps} />;
      case 'xlsx':
      case 'xls':
        return <XLSXViewer {...viewerProps} />;
      default:
        return (
          <View style={[styles.defaultViewer, { backgroundColor: colors.background }]}>
            <View style={styles.defaultContent}>
              <Icon name="description" size={48} color={colors.textSecondary || '#999'} />
              <Text style={[styles.defaultTitle, { color: colors.text || '#000' }]}>
                Preview not available
              </Text>
              <Text style={[styles.defaultSubtitle, { color: colors.textSecondary || '#666' }]}>
                This file type cannot be previewed directly
              </Text>
              <TouchableOpacity 
                style={[styles.closeButton, { backgroundColor: colors.primary || '#2274F0' }]}
                onPress={onClose}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      colors={colors}
      snapPoints={getSnapPoints()}
      initialSnapIndex={getInitialSnapIndex()}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border || '#E0E0E0' }]}>
          <View style={styles.headerContent}>
            <Text style={[styles.headerTitle, { color: colors.text || '#000' }]} numberOfLines={1}>
              {filename || 'File Preview'}
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary || '#666' }]}>
              {fileType?.toUpperCase() || 'FILE'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleOpenFull} style={styles.headerActionButton}>
              <Icon name="open-in-new" size={22} color={colors.primary || '#2274F0'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.headerActionButton}>
              <Icon name="close" size={24} color={colors.text || '#000'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* File Viewer Content */}
        <View style={styles.viewerContent}>
          {renderFileViewer()}
        </View>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0, // Ensure proper flex behavior
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  viewerContent: {
    flex: 1,
    minHeight: 0, // Ensure proper flex behavior
    overflow: 'hidden', // Prevent content overflow
  },
  defaultViewer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  defaultTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  defaultSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  closeButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default FileViewerBottomSheet;