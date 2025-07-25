/**
 * @typedef {Object} VideoCreationResponse
 * @property {string} message
 * @property {string} videoId
 * @property {string} [taskId]
 * @property {string} taskStatus - Server returns taskStatus for the initial status
 * @property {string} [status] - Keep this for backward compatibility
 * @property {string} [requestId]
 * @property {number} [coinsDeducted]
 * @property {string} [videoUrl] - URL of the video if already generated
 * @property {string} [submitTime] - Time when the video generation was submitted
 * @property {string} [endTime] - Time when the video generation was completed
 * @property {string} [origPrompt] - Original prompt text
 * @property {string} [actualPrompt] - Actual prompt used for generation
 */

/**
 * @typedef {Object} VideoStatusResponse
 * @property {string} message
 * @property {string} [videoId]
 * @property {string} [status]
 * @property {string} [taskStatus] - Server returns taskStatus for video generation status
 * @property {string} [videoUrl]
 * @property {string} [error]
 * @property {string} [submitTime]
 * @property {string} [endTime]
 * @property {string} [origPrompt]
 * @property {string} [actualPrompt]
 * @property {string} [promptText] - The prompt text used for the video
 * @property {string} [createdAt] - Timestamp when the video was created
 */

/**
 * @typedef {Object} VideoItem
 * @property {string} video_id
 * @property {string} prompt_text
 * @property {string} size
 * @property {string} task_status
 * @property {string} [video_url]
 * @property {string} created_at
 * @property {string} [task_id]
 * @property {string} [api_type]
 */

/**
 * @typedef {Object} VideoListResponse
 * @property {string} message
 * @property {VideoItem[]} videos
 * @property {number} totalCount
 */

/**
 * @typedef {Object} VideoSummary
 * @property {number} total
 * @property {number} ready
 * @property {number} processing
 * @property {number} failed
 * @property {number} unknown
 */

/**
 * @typedef {Object} EnhancedVideoItem
 * @property {string} videoId
 * @property {string} promptText
 * @property {string} size
 * @property {string} taskId
 * @property {string} taskStatus
 * @property {string} statusDisplay
 * @property {boolean} isReady
 * @property {boolean} hasVideo
 * @property {string} [videoUrl]
 * @property {string} createdAt
 * @property {string} ageDisplay
 * @property {string} apiType
 * @property {string} [requestId]
 * @property {string} [submitTime]
 * @property {string} [scheduledTime]
 * @property {string} [endTime]
 * @property {string} [origPrompt]
 * @property {string} [actualPrompt]
 * @property {number} [coinsDeducted]
 * @property {string} [error]
 */


/**
 * @typedef {Object} EnhancedVideoListResponse
 * @property {string} message
 * @property {string} uid
 * @property {VideoSummary} summary
 * @property {EnhancedVideoItem[]} videos
 * @property {number} totalCount
 */

/**
 * @typedef {Object} VideoRemoveResponse
 * @property {string} message
 */

const API_BASE_URL = 'https://main-matrixai-server-lujmidrakh.cn-hangzhou.fcapp.run';

export const videoService = {
  /**
   * Create a new video
   * @param {Object} params - The parameters for creating a video
   * @param {string} params.uid - The user ID
   * @param {string} params.promptText - The prompt text for the video
   * @param {string} [params.size='1280*720'] - The size of the video
   * @returns {Promise<VideoCreationResponse>} The video creation response
   */
  createVideo: async (params) => {
    const { uid, promptText, size = '1280*720' } = params;
    const response = await fetch(`${API_BASE_URL}/api/video/createVideo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid,
        promptText,
        size
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || 'Failed to create video');
    }

    return response.json();
  },
  
  /**
   * Create a new video with an image URL
   * @param {Object} params - The parameters for creating a video with an image
   * @param {string} params.uid - The user ID
   * @param {string} params.promptText - The prompt text for the video
   * @param {string} params.imageUrl - The URL of the image to use in the video
   * @param {string} [params.size='1280*720'] - The size of the video
   * @returns {Promise<VideoCreationResponse>} The video creation response
   */
  createVideoWithImage: async (params) => {
    const { uid, promptText, imageUrl, size = '1280*720' } = params;
    
    // Validate required parameters
    if (!uid || !promptText || !imageUrl) {
      console.error('Missing required parameters:', { uid: !!uid, promptText: !!promptText, imageUrl: !!imageUrl });
      throw new Error('UID, promptText, and imageUrl are required');
    }
    
    console.log('Creating video with image, parameters:', { 
      uid, 
      promptText, 
      imageUrl,
      size 
    });
    
    try {
      // Log the full URL being used
      console.log('API endpoint:', `${API_BASE_URL}/api/video/createVideowithurl`);
      
      // Simplified approach - directly use the image URL without additional validation
      // This matches the successful curl command approach
      const response = await fetch(`${API_BASE_URL}/api/video/createVideowithurl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid,
          promptText,
          image_url: imageUrl,
        }),
      });
      
      console.log('Request sent with image_url:', imageUrl);
      console.log('API response status:', response.status);
      
      // Simple response handling without complex error parsing
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API error response:', errorData, 'Status:', response.status);
        throw new Error(errorData.message || errorData.error || 'Failed to create video with image');
      }

      const result = await response.json();
      console.log('API success response:', result);
      return result;
    } catch (error) {
      console.error('Error in createVideoWithImage:', error);
      throw new Error('Video creation failed: ' + (error.message || 'Unknown error'));
    }
  },

  /**
   * Get the status of a video
   * @param {Object} params - The parameters for getting video status
   * @param {string} params.uid - The user ID
   * @param {string} params.videoId - The video ID
   * @returns {Promise<VideoStatusResponse>} The video status response
   */
  getVideoStatus: async (params) => {
    const { uid, videoId } = params;
    const response = await fetch(`${API_BASE_URL}/api/video/getVideoStatus`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid,
        videoId
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || 'Failed to get video status');
    }

    return response.json();
  },

  /**
   * Get all videos (simple POST method)
   * @param {Object} params - The parameters for getting all videos
   * @param {string} params.uid - The user ID
   * @returns {Promise<VideoListResponse>} The video list response
   */
  getAllVideos: async (params) => {
    const { uid } = params;
    const response = await fetch(`${API_BASE_URL}/api/video/getAllVideos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || 'Failed to get videos');
    }

    return response.json();
  },

  /**
   * Get all videos (enhanced with GET endpoint)
   * @param {Object} params - The parameters for getting enhanced videos
   * @param {string} params.uid - The user ID
   * @returns {Promise<EnhancedVideoListResponse>} The enhanced video list response
   */
  getAllVideosEnhanced: async (params) => {
    // This is the same as getAllVideosSimple, as the API examples show this is the enhanced version
    return videoService.getAllVideosSimple(params);
  },
  
  /**
   * Get all videos (simple GET endpoint)
   * @param {Object} params - The parameters for getting all videos
   * @param {string} params.uid - The user ID
   * @returns {Promise<VideoListResponse>} The video list response
   */
  getAllVideosSimple: async (params) => {
    const { uid } = params;
    const response = await fetch(`${API_BASE_URL}/api/video/${encodeURIComponent(uid)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || 'Failed to get videos');
    }

    return response.json();
  },

  /**
   * Remove a video
   * @param {Object} params - The parameters for removing a video
   * @param {string} params.uid - The user ID
   * @param {string} params.videoId - The video ID
   * @returns {Promise<VideoRemoveResponse>} The video removal response
   */
  removeVideo: async (params) => {
    const { uid, videoId } = params;
    const response = await fetch(`${API_BASE_URL}/api/video/removeVideo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid,
        videoId
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || 'Failed to remove video');
    }

    return response.json();
  },

  /**
   * Create a video with an image and poll until completion
   * @param {Object} params - The parameters for creating a video with an image
   * @param {string} params.uid - The user ID
   * @param {string} params.promptText - The prompt text for the video
   * @param {string} params.imageUrl - The URL of the image to use in the video
   * @param {number} [params.pollInterval=1000] - Polling interval in milliseconds
   * @param {Function} [params.onStatusUpdate] - Optional callback for status updates
   * @returns {Promise<VideoCreationResponse>} The final video creation response
   */
  createVideoWithImageAndPoll: async (params) => {
    const { uid, promptText, imageUrl, pollInterval = 1000, onStatusUpdate } = params;
    
    // First create the video
    const createResponse = await videoService.createVideoWithImage({
      uid,
      promptText,
      imageUrl
    });
    
    // Extract videoId from the response
    const { videoId } = createResponse;
    
    if (!videoId) {
      throw new Error('No videoId returned from video creation');
    }
    
    // If there's already a videoUrl in the response, return it immediately
    if (createResponse.videoUrl && createResponse.taskStatus === 'SUCCEEDED') {
      return createResponse;
    }
    
    // Function to poll for status
    const pollForStatus = () => {
      return new Promise((resolve, reject) => {
        const checkStatus = async () => {
          try {
            const statusResponse = await videoService.getVideoStatus({ uid, videoId });
            
            // Call the status update callback if provided
            if (onStatusUpdate && typeof onStatusUpdate === 'function') {
              onStatusUpdate(statusResponse);
            }
            
            // Check if video is ready
            if (statusResponse.taskStatus === 'SUCCEEDED' && statusResponse.videoUrl) {
              resolve(statusResponse);
              return;
            }
            
            // Check if video failed
            if (statusResponse.taskStatus === 'FAILED') {
              reject(new Error(statusResponse.error || 'Video generation failed'));
              return;
            }
            
            // Continue polling
            setTimeout(checkStatus, pollInterval);
          } catch (error) {
            reject(error);
          }
        };
        
        // Start polling
        checkStatus();
      });
    };
    
    // Start polling and return the final result
    return pollForStatus();
  }
};