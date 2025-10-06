// Image service for handling API calls related to image generation and management
import { API_BASE_URL } from '../config/api';

export const imageService = {
  // Generate images using the correct API endpoint
  generateImage: async (uid, promptText, imageCount = 4) => {
    const response = await fetch(`${API_BASE_URL}/api/image/createImage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid,
        promptText,
        imageCount
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || 'Failed to generate image');
    }

    return response.json();
  },

  // Get image generation status and results
  getImageStatus: async (uid, taskId) => {
    const response = await fetch(`${API_BASE_URL}/api/image/getImageStatus`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid,
        taskId
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || 'Failed to get image status');
    }

    return response.json();
  },

  // Get all images for a user
  getAllImages: async (uid) => {
    const response = await fetch(`${API_BASE_URL}/api/image/getAllImages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || 'Failed to get images');
    }

    return response.json();
  },

  // Get images (GET endpoint)
  getImage: async (uid) => {
    const response = await fetch(`${API_BASE_URL}/api/image/getImage/${encodeURIComponent(uid)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to get images');
    }

    return response.json();
  },

  // Get generated images (GET endpoint)
  getGeneratedImage: async (uid) => {
    const response = await fetch(`${API_BASE_URL}/api/image/getGeneratedImage/${encodeURIComponent(uid)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to get generated images');
    }

    return response.json();
  },

  // Get image history (alias for getAllImages with pagination support)
  getImageHistory: async (uid, page = 1, limit = 10) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/image/getAllImages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid,
          page,
          limit
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Failed to get image history');
      }

      const result = await response.json();
      
      // Transform the response to match expected format
      const transformedData = (result.images || []).map((img) => ({
        ...img,
        url: img.image_url // Add url property for backward compatibility
      }));

      return {
        success: true,
        data: transformedData
      };
    } catch (error) {
      throw error;
    }
  },

  // Remove image
  removeImage: async (uid, imageId) => {
    const response = await fetch(`${API_BASE_URL}/api/image/removeImage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid,
        imageId
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to remove image');
    }

    return response.json();
  },

  // Enhance image from URL
  enhanceImageFromUrl: async (uid, promptText, userImageUrl) => {
    const response = await fetch(`${API_BASE_URL}/api/image/createImageFromUrl`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid,
        promptText,
        userImageUrl
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || 'Failed to enhance image');
    }

    return response.json();
  },

  // Create image from multiple URLs
  createImageFromUrls: async (uid, promptText, imageUrls) => {
    const response = await fetch(`${API_BASE_URL}/api/image/createImageFromUrl`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid,
        promptText,
        imageUrls
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || 'Failed to create image from URLs');
    }

    return response.json();
  },

  // Get all image prompts/templates
  getAllImagePrompts: async () => {
    const response = await fetch(`${API_BASE_URL}/api/image-prompt/getAllImagePrompts`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || 'Failed to get image prompts');
    }

    return response.json();
  }
};