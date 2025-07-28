// Video Service Interfaces
/**
 * @typedef {Object} VideoGenerationResponse
 * @property {string} message - Response message
 * @property {string} videoId - ID of the generated video
 * @property {string} status - Status of the video generation
 * @property {string} [videoUrl] - URL of the generated video
 * @property {string} [taskId] - ID of the generation task
 * @property {string} [error] - Error message if any
 */

/**
 * @typedef {Object} VideoGenerationWithNegativePromptResponse
 * @property {string} message - Response message
 * @property {string} videoId - ID of the generated video
 * @property {string} status - Status of the video generation
 * @property {string} [videoUrl] - URL of the generated video
 * @property {string} [taskId] - ID of the generation task
 * @property {string} [error] - Error message if any
 * @property {string} [negative_prompt] - Negative prompt used for generation
 */

/**
 * @typedef {Object} VideoHistoryResponseItem
 * @property {string} video_id - ID of the video
 * @property {string} prompt_text - Prompt text used for generation
 * @property {string} [video_url] - URL of the generated video
 * @property {string} status - Status of the video generation
 * @property {string} created_at - Creation timestamp
 * @property {string} [task_id] - ID of the generation task
 * @property {string} [template] - Template used for generation
 * @property {string} [image_url] - URL of the image used
 * @property {string} [size] - Size of the video
 * @property {string} [error_message] - Error message if any
 */

/**
 * @typedef {Object} PaginationInfo
 * @property {number} totalItems - Total number of items
 * @property {number} totalPages - Total number of pages
 * @property {number} currentPage - Current page number
 * @property {number} itemsPerPage - Number of items per page
 * @property {boolean} hasNextPage - Whether there is a next page
 * @property {boolean} hasPreviousPage - Whether there is a previous page
 */

/**
 * @typedef {Object} VideoHistoryResponse
 * @property {string} message - Response message
 * @property {VideoHistoryResponseItem[]} videos - Array of video history items
 * @property {number} [totalItems] - Total number of items
 * @property {number} [currentPage] - Current page number
 * @property {number} [itemsPerPage] - Number of items per page
 * @property {number} [totalPages] - Total number of pages
 * @property {PaginationInfo} [pagination] - Pagination information
 */

/**
 * @typedef {Object} VideoRemoveResponse
 * @property {string} message - Response message
 */

const API_BASE_URL = 'http://192.168.1.36:3002';

/**
 * Helper function to convert React Native image object to FormData
 * @param {Object} imageFile - Image file object from react-native-image-picker
 * @returns {Promise<string>} The processed image URI
 */
const prepareImageForUpload = async (imageFile) => {
  try {
    // Check if the image is in HEIC format and convert if needed
    let processedImageUri = imageFile.uri;
    const isHeic = imageFile.type === 'image/heic' || 
                  imageFile.uri.toLowerCase().endsWith('.heic') || 
                  imageFile.uri.toLowerCase().endsWith('.heif');
    
    if (isHeic) {
      console.log('HEIC format detected, converting to JPEG...');
      // Use react-native-image-resizer for conversion
      const ImageResizer = require('@bam.tech/react-native-image-resizer').default;
      
      const response = await ImageResizer.createResizedImage(
        imageFile.uri,
        1280, // width
        720,  // height
        'JPEG', // format
        80,    // quality
        0,     // rotation
        null,  // outputPath
        false  // keepMeta
      );
      
      processedImageUri = response.uri;
      console.log('HEIC image converted to JPEG:', processedImageUri);
    }
    
    // Check if the image needs to be compressed
    if (imageFile.fileSize > 5 * 1024 * 1024) {
      console.log('Image is larger than 5MB, compressing...');
      
      // Use react-native-image-resizer for compression
      const ImageResizer = require('@bam.tech/react-native-image-resizer').default;
      
      // Start with high quality and reduce if needed
      let quality = 80;
      let compressedUri = processedImageUri;
      
      while (quality >= 30) {
        const response = await ImageResizer.createResizedImage(
          processedImageUri,
          1280, // width
          720,  // height
          'JPEG', // format
          quality, // quality
          0,     // rotation
          null,  // outputPath
          false  // keepMeta
        );
        
        // Get file stats to check size
        const RNFS = require('react-native-fs');
        const fileStats = await RNFS.stat(response.uri);
        
        if (fileStats.size <= 5 * 1024 * 1024) {
          compressedUri = response.uri;
          console.log(`Compressed image to ${(fileStats.size / (1024 * 1024)).toFixed(2)}MB with quality ${quality}`);
          break;
        }
        
        // Reduce quality and try again
        quality -= 10;
        compressedUri = response.uri;
      }
      
      processedImageUri = compressedUri;
    }
    
    return processedImageUri;
  } catch (error) {
    console.error('Error preparing image for upload:', error);
    throw error;
  }
};

// Export the videoService object
export const videoService = {
  /**
   * Create video with negative prompt
   * @param {Object} params - The parameters for video creation
   * @param {string} params.uid - User ID
   * @param {string} params.promptText - Text prompt for video generation
   * @param {string} params.negativePrompt - Negative prompt to exclude certain elements
   * @param {string} [params.size='720P'] - Video size/resolution
   * @returns {Promise<VideoGenerationWithNegativePromptResponse>} The video generation response
   */
  createVideoWithNegativePrompt: async ({ uid, promptText, negativePrompt, size = '720P' }) => {
    const response = await fetch(`${API_BASE_URL}/api/video/createVideo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid,
        promptText,
        negative_prompt: negativePrompt,
        size
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || 'Failed to generate video with negative prompt');
    }

    return response.json();
  },
  /**
   * Create video with text prompt only
   * @param {Object} params - The parameters for video creation
   * @param {string} params.uid - User ID
   * @param {string} params.promptText - Text prompt for video generation
   * @param {string} [params.size='720P'] - Video size/resolution
   * @returns {Promise<VideoGenerationResponse>} The video generation response
   */
  createVideo: async ({ uid, promptText, size = '720P' }) => {
    const response = await fetch(`${API_BASE_URL}/api/video/createVideo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid,
        promptText,
        size
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || 'Failed to generate video');
    }

    return response.json();
  },
  
  /**
   * Create video with image file
   * @param {Object} params - The parameters for video creation
   * @param {string} params.uid - User ID
   * @param {string} params.promptText - Text prompt for video generation
   * @param {Object} params.imageFile - Image file object from react-native-image-picker
   * @param {string} [params.template] - Template to use for video generation
   * @param {string} [params.negativePrompt] - Negative prompt to exclude certain elements
   * @param {string} [params.size='720P'] - Video size/resolution
   * @returns {Promise<VideoGenerationResponse>} The video generation response
   */
  createVideoWithImage: async ({ uid, promptText, imageFile, template, negativePrompt, size = '720P' }) => {
    try {
      // If we have an image file object from react-native-image-picker
      if (imageFile) {
        console.log('Processing image file for upload:', imageFile);
        console.log('Image file details:', JSON.stringify({
          uri: imageFile.uri,
          fileName: imageFile.fileName || 'unnamed file',
          type: imageFile.type,
          fileSize: imageFile.fileSize
        }));
        
        // Process the image (convert HEIC and compress if needed)
        const processedImageUri = await prepareImageForUpload(imageFile);
        console.log('Processed image URI:', processedImageUri);
        
        // Create form data for the API request
        const formData = new FormData();
        formData.append('uid', uid);
        
        // Add the processed image to form data
        const filename = processedImageUri.split('/').pop();
        const match = /\.(\w+)$/i.exec(filename);
        let type = 'image/jpeg'; // Default to JPEG
        
        if (match) {
          const extension = match[1].toLowerCase();
          if (extension === 'jpg' || extension === 'jpeg') {
            type = 'image/jpeg';
          } else if (extension === 'png') {
            type = 'image/png';
          } else if (extension === 'gif') {
            type = 'image/gif';
          } else if (extension === 'webp') {
            type = 'image/webp';
          } else if (extension === 'heic' || extension === 'heif') {
            // HEIC should have been converted to JPEG by prepareImageForUpload
            type = 'image/jpeg';
          } else {
            // For any other extension, try to use it or default to JPEG
            type = `image/${extension}`;
          }
        }
        
        console.log('Image file type determined:', type);
        
        formData.append('image', {
          uri: processedImageUri,
          name: filename,
          type: type
        });
        
        if (template) {
          formData.append('template', template);
          console.log('Added template to form data:', template);
        }
        
        if (negativePrompt) {
          formData.append('negative_prompt', negativePrompt);
        }
        
        if (promptText) {
          formData.append('promptText', promptText);
          console.log('Added promptText to form data:', promptText);
        }
        
        if (size) {
          formData.append('size', size);
        }
        
        console.log('Sending form data with image to API');
        
        const response = await fetch(`${API_BASE_URL}/api/video/createVideo`, {
          method: 'POST',
          body: formData,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        
        console.log('API response status:', response.status);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('API error:', errorData);
          throw new Error(errorData.message || errorData.error || 'Failed to generate video from image');
        }
        
        const result = await response.json();
        console.log('API success response:', result);
        return result;
      } 
      // If we have an image URL instead of a file
      else if (arguments[0].imageUrl) {
        console.log('Using imageUrl instead of imageFile');
        const { imageUrl, ...rest } = arguments[0];
        return videoService.createVideoWithUrl({ ...rest, imageUrl });
      } else {
        console.error('Missing required image data');
        throw new Error('Either imageFile or imageUrl is required');
      }
    } catch (error) {
      console.error('Error in createVideoWithImage:', error);
      throw error;
    }
  },

  /**
   * Create video with image URL
   * @param {Object} params - The parameters for video creation
   * @param {string} params.uid - User ID
   * @param {string} params.promptText - Text prompt for video generation
   * @param {string} params.imageUrl - URL of the image to use
   * @param {string} [params.negativePrompt] - Negative prompt to exclude certain elements
   * @param {string} [params.template] - Template to use for video generation
   * @param {string} [params.size='720P'] - Video size/resolution
   * @returns {Promise<VideoGenerationResponse>} The video generation response
   */
  createVideoWithUrl: async ({ uid, promptText, imageUrl, negativePrompt, template, size = '720P' }) => {
    try {
      // Create request body
      const requestBody = {
        uid,
        promptText,
        imageUrl,
        size
      };
      
      if (template) {
        requestBody.template = template;
      }
      
      if (negativePrompt) {
        requestBody.negative_prompt = negativePrompt;
      }
      
      const response = await fetch(`${API_BASE_URL}/api/video/createVideo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Failed to generate video from image URL');
      }
      
      return response.json();
    } catch (error) {
      console.error('Error in createVideoWithUrl:', error);
      throw error;
    }
  },

  /**
   * Get video status
   * @param {Object} params - The parameters for status check
   * @param {string} params.uid - User ID
   * @param {string} params.videoId - ID of the video to check
   * @returns {Promise<VideoGenerationResponse>} The video status response
   */
  getVideoStatus: async ({ uid, videoId }) => {
    const response = await fetch(`${API_BASE_URL}/api/video/getVideoStatus`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid,
        videoId
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || 'Failed to get video status');
    }

    return response.json();
  },

  /**
   * Get all videos for a user
   * @param {Object} params - The parameters for fetching videos
   * @param {string} params.uid - User ID
   * @param {number} [params.page=1] - Page number for pagination
   * @param {number} [params.itemsPerPage=10] - Number of items per page
   * @returns {Promise<VideoHistoryResponse>} The video history response
   */
  getAllVideos: async ({ uid, page = 1, itemsPerPage = 10 }) => {
    const response = await fetch(`${API_BASE_URL}/api/video/getVideoHistory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid,
        page,
        itemsPerPage
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || 'Failed to fetch video history');
    }

    return response.json();
  },
  
  /**
   * Enhanced version of getAllVideos with additional processing
   * @param {Object} params - The parameters for fetching videos
   * @param {string} params.uid - User ID
   * @param {number} [params.page=1] - Page number for pagination
   * @param {number} [params.itemsPerPage=10] - Number of items per page
   * @returns {Promise<VideoHistoryResponse>} The enhanced video history response with normalized data
   */
  getAllVideosEnhanced: async ({ uid, page = 1, itemsPerPage = 10 }) => {
    try {
      const result = await videoService.getAllVideos({ uid, page, itemsPerPage });
      
      // Process videos to add additional fields and normalize data
      if (result.videos && Array.isArray(result.videos)) {
        result.videos = result.videos.map(video => {
          // Calculate age display
          const createdAt = new Date(video.created_at);
          const now = new Date();
          const diffMs = now - createdAt;
          const diffMins = Math.floor(diffMs / (1000 * 60));
          const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          
          let ageDisplay = 'Just now';
          if (diffMins > 1 && diffMins < 60) {
            ageDisplay = `${diffMins} minutes ago`;
          } else if (diffHours >= 1 && diffHours < 24) {
            ageDisplay = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
          } else if (diffDays >= 1) {
            ageDisplay = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
          }
          
          // Normalize status display
          let statusDisplay = 'Processing';
          let isReady = false;
          
          if (video.status === 'SUCCEEDED' || video.status === 'completed') {
            statusDisplay = 'Ready';
            isReady = true;
          } else if (video.status === 'FAILED' || video.status === 'failed') {
            statusDisplay = 'Failed';
          } else if (video.status === 'PROCESSING' || video.status === 'processing') {
            statusDisplay = 'Processing';
          }
          
          return {
            ...video,
            videoId: video.video_id,
            promptText: video.prompt_text,
            videoUrl: video.video_url,
            taskStatus: video.status,
            ageDisplay,
            statusDisplay,
            isReady
          };
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error in getAllVideosEnhanced:', error);
      throw error;
    }
  },

  /**
   * Remove a video
   * @param {Object} params - The parameters for video removal
   * @param {string} params.uid - User ID
   * @param {string} params.videoId - ID of the video to remove
   * @returns {Promise<VideoRemoveResponse>} The video removal response
   */
  removeVideo: async ({ uid, videoId }) => {
    const response = await fetch(`${API_BASE_URL}/api/video/removeVideo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid,
        videoId
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || 'Failed to remove video');
    }

    return response.json();
  }
};

// Add default export
export default videoService;