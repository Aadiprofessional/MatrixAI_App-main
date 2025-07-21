interface ImageGenerationResponse {
  message: string;
  taskId: string;
  status: string;
  requestedCount: number;
  coinsDeducted: number;
}

interface ImageStatusResponse {
  message: string;
  images?: Array<{
    imageId: string;
    imageName: string;
    imageUrl: string;
    imagePath: string;
  }>;
  status: string;
  totalImages?: number;
  error?: string;
}

interface ImageListResponse {
  message: string;
  images: Array<{
    image_id: string;
    image_name: string;
    image_url: string;
    image_path: string;
    prompt_text: string;
    created_at: string;
  }>;
}

interface ImageHistoryResponse {
  success: boolean;
  data: Array<{
    image_id: string;
    image_name: string;
    image_url: string;
    prompt_text: string;
    created_at: string;
    url: string; // For backward compatibility
  }>;
}

interface ImageRemoveResponse {
  message: string;
}

interface ImageDataResponse {
  data: Array<{
    image_name: string;
    image_id: string;
    image_url: string;
    created_at: string;
  }>;
}

interface GeneratedImageResponse {
  data: Array<{
    image_id: string;
    image_name: string;
    image_url: string;
    prompt_text: string;
    created_at: string;
  }>;
}

const API_BASE_URL = 'https://main-matrixai-server-lujmidrakh.cn-hangzhou.fcapp.run';

export const imageService = {
  // Generate images using the correct API endpoint
  generateImage: async (uid: string, promptText: string, imageCount: number = 4): Promise<ImageGenerationResponse> => {
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
  getImageStatus: async (uid: string, taskId: string): Promise<ImageStatusResponse> => {
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
  getAllImages: async (uid: string): Promise<ImageListResponse> => {
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
  getImage: async (uid: string): Promise<ImageDataResponse> => {
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
  getGeneratedImage: async (uid: string): Promise<GeneratedImageResponse> => {
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
  getImageHistory: async (uid: string, page: number = 1, limit: number = 10): Promise<ImageHistoryResponse> => {
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
      const transformedData = (result.images || []).map((img: any) => ({
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
  removeImage: async (uid: string, imageId: string): Promise<ImageRemoveResponse> => {
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
  }
}; 