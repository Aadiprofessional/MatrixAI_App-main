import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ImageSkeletonLoader from './ImageSkeletonLoader';

const { width } = Dimensions.get('window');

const IntelligentImageContainer = ({ 
  imageData,
  onImagePress,
  onRetry,
  style = {},
  maxWidth = width - 80,
  maxHeight = 300
}) => {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: maxWidth, height: 200 });

  useEffect(() => {
    if (imageData?.imageUrl) {
      // Get image dimensions
      Image.getSize(
        imageData.imageUrl,
        (width, height) => {
          const aspectRatio = width / height;
          let newWidth = maxWidth;
          let newHeight = newWidth / aspectRatio;
          
          if (newHeight > maxHeight) {
            newHeight = maxHeight;
            newWidth = newHeight * aspectRatio;
          }
          
          setImageDimensions({ width: newWidth, height: newHeight });
        },
        (error) => {
          console.error('Error getting image size:', error);
          setImageDimensions({ width: maxWidth, height: 200 });
        }
      );
    }
  }, [imageData?.imageUrl, maxWidth, maxHeight]);

  // Show skeleton loader while generating
  if (imageData?.status === 'pending' || imageData?.status === 'generating') {
    return (
      <ImageSkeletonLoader
        description={imageData?.description || "Generating image..."}
        height={200}
        style={style}
      />
    );
  }

  // Show error state
  if (imageData?.status === 'error' || imageError || !imageData?.imageUrl) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.cardBackground }, style]}>
        <Ionicons name="alert-circle-outline" size={40} color={colors.error || '#FF6B6B'} />
        <Text style={[styles.errorText, { color: colors.error || '#FF6B6B' }]}>
          Failed to generate image
        </Text>
        {imageData?.description && (
          <Text style={[styles.errorDescription, { color: colors.textSecondary }]} numberOfLines={2}>
            {imageData.description}
          </Text>
        )}
        {onRetry && (
          <TouchableOpacity 
            style={[styles.retryButton, { backgroundColor: colors.primary || '#4C8EF7' }]}
            onPress={() => onRetry(imageData)}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Show ready image
  return (
    <View style={[styles.imageContainer, style]}>
      <TouchableOpacity
        onPress={() => onImagePress && onImagePress(imageData)}
        activeOpacity={0.9}
      >
        <View style={[styles.imageWrapper, { backgroundColor: colors.cardBackground }]}>
          {imageLoading && (
            <View style={[styles.loadingOverlay, imageDimensions]}>
              <ActivityIndicator size="large" color={colors.primary || '#4C8EF7'} />
            </View>
          )}
          
          <Image
            source={{ uri: imageData.imageUrl }}
            style={[
              styles.image,
              imageDimensions,
              { opacity: imageLoading ? 0 : 1 }
            ]}
            onLoad={() => setImageLoading(false)}
            onError={() => {
              setImageLoading(false);
              setImageError(true);
            }}
            resizeMode="contain"
          />
          
          {/* Image overlay with description */}
          {!imageLoading && imageData?.description && (
            <View style={[styles.imageOverlay, { backgroundColor: colors.overlay || 'rgba(0,0,0,0.7)' }]}>
              <Text style={styles.imageDescription} numberOfLines={2}>
                {imageData.description}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  imageContainer: {
    marginVertical: 8,
    alignItems: 'center',
  },
  imageWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  image: {
    borderRadius: 12,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    zIndex: 1,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
  },
  imageDescription: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  errorContainer: {
    borderRadius: 12,
    padding: 20,
    marginVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
    minHeight: 150,
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  errorDescription: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default IntelligentImageContainer;