import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const { width: screenWidth } = Dimensions.get('window');

const FilePreviewComponent = ({ 
  attachedFiles = [], 
  onRemoveFile,
  onFilePress,
  colors = {
    background: '#fff',
    text: '#000',
    textSecondary: '#666',
    primary: '#4C8EF7',
    border: '#e0e0e0',
    error: '#f44336'
  }
}) => {
  if (!attachedFiles || attachedFiles.length === 0) {
    return null;
  }

  const getFileIcon = (fileType, mimeType) => {
    if (fileType === 'image') {
      return { name: 'image', library: 'MaterialIcons', color: '#4CAF50' };
    }
    
    if (mimeType?.includes('pdf')) {
      return { name: 'picture-as-pdf', library: 'MaterialIcons', color: '#f44336' };
    }
    
    if (mimeType?.includes('word') || mimeType?.includes('document')) {
      return { name: 'file-word', library: 'MaterialCommunityIcons', color: '#2196F3' };
    }
    
    if (mimeType?.includes('sheet') || mimeType?.includes('excel')) {
      return { name: 'file-excel', library: 'MaterialCommunityIcons', color: '#4CAF50' };
    }
    
    if (mimeType?.includes('text') || mimeType?.includes('csv')) {
      return { name: 'description', library: 'MaterialIcons', color: '#FF9800' };
    }
    
    return { name: 'insert-drive-file', library: 'MaterialIcons', color: colors.textSecondary };
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderFilePreview = (file, index) => {
    const fileIcon = getFileIcon(file.fileType, file.type);
    const IconComponent = fileIcon.library === 'MaterialCommunityIcons' 
      ? MaterialCommunityIcons 
      : Icon;

    return (
      <View key={file.fileId || index} style={[styles.filePreviewContainer, { borderColor: colors.border }]}>
        <TouchableOpacity
          style={styles.fileContent}
          onPress={() => onFilePress && onFilePress(file, index)}
          activeOpacity={0.7}
        >
          {file.fileType === 'image' && file.uri ? (
            <View style={styles.imagePreviewContainer}>
              <Image 
                source={{ uri: file.uri }} 
                style={styles.imagePreview}
                resizeMode="cover"
              />
              <View style={[styles.imageOverlay, { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
                <Icon name="image" size={16} color="#fff" />
              </View>
            </View>
          ) : (
            <View style={[styles.fileIconContainer, { backgroundColor: fileIcon.color + '20' }]}>
              <IconComponent 
                name={fileIcon.name} 
                size={24} 
                color={fileIcon.color} 
              />
            </View>
          )}
          
          <View style={styles.fileInfo}>
            <Text 
              style={[styles.fileName, { color: colors.text }]} 
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {file.name}
            </Text>
            <Text style={[styles.fileSize, { color: colors.textSecondary }]}>
              {formatFileSize(file.size)}
            </Text>
            {file.uploadProgress !== undefined && file.uploadProgress < 100 && (
              <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { 
                        backgroundColor: colors.primary,
                        width: `${file.uploadProgress}%`
                      }
                    ]} 
                  />
                </View>
                <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                  {Math.round(file.uploadProgress)}%
                </Text>
              </View>
            )}
            {file.error && (
              <Text style={[styles.errorText, { color: colors.error }]} numberOfLines={1}>
                {file.error}
              </Text>
            )}
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => onRemoveFile && onRemoveFile(index)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="close" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {attachedFiles.map(renderFilePreview)}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingRight: 16,
  },
  filePreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginRight: 12,
    minWidth: screenWidth * 0.7,
    maxWidth: screenWidth * 0.8,
  },
  fileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  imagePreviewContainer: {
    position: 'relative',
    marginRight: 12,
  },
  imagePreview: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    borderRadius: 4,
    padding: 2,
  },
  fileIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  fileSize: {
    fontSize: 12,
    fontWeight: '400',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  progressBar: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
    marginRight: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  progressText: {
    fontSize: 10,
    fontWeight: '500',
    minWidth: 30,
  },
  errorText: {
    fontSize: 11,
    fontWeight: '400',
    marginTop: 2,
  },
  removeButton: {
    padding: 4,
    marginLeft: 8,
  },
});

export default FilePreviewComponent;