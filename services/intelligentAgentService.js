import { DASHSCOPE_API_KEY } from '@env';

/**
 * Intelligent AI Agent Service
 * Analyzes user messages and determines when images are needed for better explanations
 */

// Image generation API endpoint
const IMAGE_GENERATION_API = 'https://main-matrixai-server-lujmidrakh.cn-hangzhou.fcapp.run/api/ai-image/generateImageFromDescription';

/**
 * Analyzes user message and determines if images are needed
 * @param {string} userMessage - The user's message
 * @param {Array} conversationHistory - Previous messages for context
 * @returns {Promise<Object>} Analysis result with image requirements
 */
export const analyzeMessageForImageNeeds = async (userMessage, conversationHistory = []) => {
  try {
    const analysisPrompt = `
You are an expert visual content strategist. Analyze the user's message and create a comprehensive plan for visual content that would enhance the response. Think about the complete response structure and where images would be most effective.

User Message: "${userMessage}"

Previous Context: ${conversationHistory.slice(-4).map(msg => `${msg.sender}: ${msg.text}`).join('\n')}

Respond ONLY with a JSON object in this exact format:
{
  "needsImages": boolean,
  "imageCount": number (1-5),
  "images": [
    {
      "id": "image_1",
      "description": "Extremely detailed description including colors, style, composition, specific elements to show",
      "placementHint": "Where in the response this image should appear (beginning, middle, end, after_concept_X)",
      "priority": "high|medium|low",
      "estimatedPosition": number (approximate character position in response where image should appear),
      "insertAfterText": "Text after which this image should appear"
    }
  ],
  "responseStructure": "Brief outline of how the response should be structured with image placements",
  "reasoning": "Why these specific images would enhance understanding"
}

For mathematical concepts like parabolas, include specific equations, colors, axis labels, and visual style.
For complex topics, break down into multiple focused images rather than one complex image.
Be very specific about visual details - colors, styles, annotations, etc.

Examples of when images are needed:
- Mathematical concepts (graphs, charts, diagrams)
- Scientific explanations (molecular structures, processes)
- Data visualization requests
- Step-by-step processes
- Comparisons that benefit from visual representation
- Educational content that needs illustration

Examples of when images are NOT needed:
- Simple text-based questions
- Code-only requests
- Basic definitions
- Conversational responses
`;

    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen-plus',
        messages: [
          {
            role: 'system',
            content: 'You are an expert visual content strategist. Analyze messages and create detailed plans for visual content that enhances learning. Always respond with valid JSON and be extremely specific about image descriptions.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    });

    const data = await response.json();
    const analysisText = data.choices?.[0]?.message?.content;

    if (!analysisText) {
      return { needsImages: false, imageCount: 0, images: [], responseStructure: '', reasoning: '' };
    }

    // Parse the JSON response
    try {
      const analysis = JSON.parse(analysisText);
      return {
        needsImages: analysis.needsImages || false,
        imageCount: Math.min(analysis.imageCount || 0, 5), // Limit to 5 images max
        images: (analysis.images || []).slice(0, 5).map((img, index) => ({
          id: img.id || `image_${index + 1}`,
          description: img.description || '',
          placementHint: img.placementHint || '',
          priority: img.priority || 'medium',
          estimatedPosition: img.estimatedPosition || 0,
          insertAfterText: img.insertAfterText || '',
          status: 'pending', // pending, generating, ready, error
          imageUrl: null,
          imageId: null
        })),
        responseStructure: analysis.responseStructure || '',
        reasoning: analysis.reasoning || ''
      };
    } catch (parseError) {
      console.error('Error parsing analysis JSON:', parseError);
      return { needsImages: false, imageCount: 0, images: [], responseStructure: '', reasoning: '' };
    }

  } catch (error) {
    console.error('Error analyzing message for image needs:', error);
    return { needsImages: false, imageCount: 0, images: [], responseStructure: '', reasoning: '' };
  }
};

/**
 * Generates an image using the new API endpoint
 * @param {string} uid - User ID
 * @param {string} description - Image description
 * @param {number} coinCost - Cost in coins (default 50)
 * @returns {Promise<Object>} Generation result
 */
export const generateImageFromDescription = async (uid, description, coinCost = 50) => {
  try {
    const response = await fetch(IMAGE_GENERATION_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid,
        description,
        coinCost
      })
    });

    const data = await response.json();

    if (data.success) {
      return {
        success: true,
        imageUrl: data.imageUrl,
        imageId: data.imageId,
        description: data.description,
        coinsDeducted: data.coinsDeducted
      };
    } else {
      return {
        success: false,
        error: data.message || 'Image generation failed'
      };
    }
  } catch (error) {
    console.error('Error generating image:', error);
    return {
      success: false,
      error: error.message || 'Network error during image generation'
    };
  }
};

/**
 * Starts parallel image generation without waiting for completion
 * @param {string} uid - User ID
 * @param {Array} images - Array of image objects with descriptions
 * @param {number} coinCost - Cost per image in coins
 * @returns {Promise<Array>} Array of generation promises with tracking
 */
export const startParallelImageGeneration = async (uid, images, coinCost = 50) => {
  try {
    const generationTasks = images.map(async (image, index) => {
      try {
        console.log(`Starting generation for image ${image.id}: ${image.description}`);
        
        // Start the generation immediately
        const generationPromise = generateImageFromDescription(uid, image.description, coinCost);
        
        return {
          id: image.id,
          description: image.description,
          placementHint: image.placementHint,
          priority: image.priority,
          estimatedPosition: image.estimatedPosition,
          insertAfterText: image.insertAfterText,
          status: 'generating',
          generationPromise,
          startTime: Date.now()
        };
      } catch (error) {
        console.error(`Error starting generation for image ${image.id}:`, error);
        return {
          id: image.id,
          description: image.description,
          placementHint: image.placementHint,
          priority: image.priority,
          estimatedPosition: image.estimatedPosition,
          insertAfterText: image.insertAfterText,
          status: 'error',
          error: error.message,
          startTime: Date.now()
        };
      }
    });

    // Return all tasks immediately without waiting
    const tasks = await Promise.all(generationTasks);
    console.log(`Started ${tasks.length} parallel image generation tasks`);
    
    return tasks;
  } catch (error) {
    console.error('Error starting parallel image generation:', error);
    return images.map(image => ({
      id: image.id,
      description: image.description,
      placementHint: image.placementHint,
      priority: image.priority,
      estimatedPosition: image.estimatedPosition,
      insertAfterText: image.insertAfterText,
      status: 'error',
      error: error.message,
      startTime: Date.now()
    }));
  }
};

/**
 * Checks if a specific image is ready
 * @param {Object} imageTask - Image generation task
 * @returns {Promise<Object>} Updated image task with result
 */
export const checkImageStatus = async (imageTask) => {
  if (imageTask.status !== 'generating' || !imageTask.generationPromise) {
    return imageTask;
  }

  try {
    // Check if the promise is resolved
    const result = await Promise.race([
      imageTask.generationPromise,
      new Promise(resolve => setTimeout(() => resolve(null), 0)) // Non-blocking check
    ]);

    if (result !== null) {
      // Promise is resolved
      if (result.success) {
        return {
          ...imageTask,
          status: 'ready',
          imageUrl: result.imageUrl,
          completionTime: Date.now(),
          generationDuration: Date.now() - imageTask.startTime
        };
      } else {
        return {
          ...imageTask,
          status: 'error',
          error: result.error || 'Generation failed',
          completionTime: Date.now()
        };
      }
    } else {
      // Still generating
      return imageTask;
    }
  } catch (error) {
    return {
      ...imageTask,
      status: 'error',
      error: error.message,
      completionTime: Date.now()
    };
  }
};

/**
 * Enhanced message analysis that includes response planning
 * @param {string} userMessage - The user's message
 * @param {Array} conversationHistory - Previous messages for context
 * @returns {Promise<Object>} Complete response plan with text and image integration
 */
/**
 * Creates a comprehensive response plan with image generation coordination
 * @param {string} userMessage - User's message
 * @param {Array} conversationHistory - Previous conversation
 * @param {string} uid - User ID for image generation
 * @returns {Promise<Object>} Complete response plan with image tasks
 */
export const createResponsePlan = async (userMessage, conversationHistory = [], uid) => {
  try {
    console.log('Creating comprehensive response plan...');
    
    // Step 1: Analyze for image needs
    const imageAnalysis = await analyzeMessageForImageNeeds(userMessage, conversationHistory);
    
    if (!imageAnalysis || !imageAnalysis.needsImages) {
      return {
        needsImages: false,
        imageTasks: [],
        responseStructure: null,
        totalImages: 0
      };
    }

    console.log(`Found ${imageAnalysis.images.length} images needed`);

    // Step 2: Start parallel image generation immediately
    const imageTasks = await startParallelImageGeneration(uid, imageAnalysis.images);
    
    // Step 3: Create response structure plan
    const responseStructure = imageAnalysis.responseStructure || [];
    
    console.log('Response plan created with parallel image generation started');
    
    return {
      needsImages: true,
      imageTasks,
      responseStructure,
      totalImages: imageAnalysis.images.length,
      estimatedLength: imageAnalysis.estimatedResponseLength || 1000,
      images: imageAnalysis.images // Keep original image metadata
    };

  } catch (error) {
    console.error('Error creating response plan:', error);
    return {
      needsImages: false,
      imageTasks: [],
      responseStructure: null,
      totalImages: 0,
      error: error.message
    };
  }
};

/**
 * Waits for a specific image to be ready with timeout
 * @param {Object} imageTask - Image generation task
 * @param {number} maxWaitTime - Maximum wait time in milliseconds
 * @returns {Promise<Object>} Updated image task
 */
export const waitForImage = async (imageTask, maxWaitTime = 30000) => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    const updatedTask = await checkImageStatus(imageTask);
    
    if (updatedTask.status === 'ready' || updatedTask.status === 'error') {
      return updatedTask;
    }
    
    // Wait a bit before checking again
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Timeout reached
  return {
    ...imageTask,
    status: 'timeout',
    error: 'Image generation timed out'
  };
};