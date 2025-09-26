import { DASHSCOPE_API_KEY } from '@env';
import { checkImageStatus, waitForImage } from './intelligentAgentService';

/**
 * Enhanced streaming service that coordinates text streaming with parallel image generation
 */
export class StreamingService {
  constructor() {
    this.streamingState = {
      currentPosition: 0,
      pendingImages: [],
      readyImages: [],
      streamedContent: '',
      isStreaming: false
    };
  }

  /**
   * Starts streaming with parallel image coordination
   * @param {string} userMessage - User's message
   * @param {Array} conversationHistory - Conversation history
   * @param {Object} responsePlan - Response plan with image tasks
   * @param {Function} onTextChunk - Callback for text chunks
   * @param {Function} onImageReady - Callback when image is ready to insert
   * @param {Function} onComplete - Callback when streaming is complete
   */
  async startStreamingWithImages(userMessage, conversationHistory, responsePlan, onTextChunk, onImageReady, onComplete) {
    try {
      console.log('Starting enhanced streaming with parallel images...');
      
      // Initialize streaming state
      this.streamingState = {
        currentPosition: 0,
        pendingImages: responsePlan.imageTasks || [],
        readyImages: [],
        streamedContent: '',
        isStreaming: true
      };

      // Start the text streaming
      await this.streamTextWithImageCoordination(
        userMessage, 
        conversationHistory, 
        responsePlan,
        onTextChunk, 
        onImageReady, 
        onComplete
      );

    } catch (error) {
      console.error('Error in streaming with images:', error);
      onComplete(error);
    }
  }

  /**
   * Streams text while coordinating image insertion
   */
  async streamTextWithImageCoordination(userMessage, conversationHistory, responsePlan, onTextChunk, onImageReady, onComplete) {
    try {
      const streamingPrompt = this.buildStreamingPrompt(userMessage, conversationHistory, responsePlan);
      
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
              content: 'You are a helpful AI assistant. Provide detailed, educational responses. When explaining concepts that benefit from visual aids, structure your response to naturally accommodate images at appropriate points.'
            },
            {
              role: 'user',
              content: streamingPrompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2000,
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (this.streamingState.isStreaming) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              this.streamingState.isStreaming = false;
              break;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              
              if (content) {
                await this.processTextChunk(content, onTextChunk, onImageReady);
              }
            } catch (parseError) {
              console.warn('Error parsing streaming data:', parseError);
            }
          }
        }
      }

      // Handle any remaining pending images
      await this.handleRemainingImages(onImageReady);
      
      onComplete(null);

    } catch (error) {
      console.error('Error in text streaming:', error);
      onComplete(error);
    }
  }

  /**
   * Processes each text chunk and determines if images should be inserted
   */
  async processTextChunk(textChunk, onTextChunk, onImageReady) {
    this.streamingState.streamedContent += textChunk;
    this.streamingState.currentPosition += textChunk.length;

    // Send the text chunk
    onTextChunk(textChunk);

    // Check if any images should be inserted at this position
    await this.checkForImageInsertion(onImageReady);
  }

  /**
   * Checks if any images should be inserted at the current position
   */
  async checkForImageInsertion(onImageReady) {
    const currentPos = this.streamingState.currentPosition;
    
    // Check each pending image to see if it should be inserted
    for (let i = this.streamingState.pendingImages.length - 1; i >= 0; i--) {
      const imageTask = this.streamingState.pendingImages[i];
      
      // Determine if this image should be inserted now
      const shouldInsert = this.shouldInsertImageNow(imageTask, currentPos);
      
      if (shouldInsert) {
        console.log(`Attempting to insert image ${imageTask.id} at position ${currentPos}`);
        
        // Check if image is ready
        const updatedTask = await checkImageStatus(imageTask);
        
        if (updatedTask.status === 'ready') {
          // Image is ready, insert it
          console.log(`Image ${imageTask.id} is ready, inserting now`);
          onImageReady(updatedTask);
          
          // Move to ready images
          this.streamingState.readyImages.push(updatedTask);
          this.streamingState.pendingImages.splice(i, 1);
          
        } else if (updatedTask.status === 'generating') {
          // Image not ready but needed, use adaptive waiting strategy
          console.log(`Image ${imageTask.id} needed but not ready, applying wait strategy...`);
          
          const waitTime = this.calculateWaitTime(imageTask, currentPos);
          const shouldWait = this.shouldWaitForImage(imageTask, currentPos);
          
          if (shouldWait && waitTime > 0) {
            console.log(`Waiting ${waitTime}ms for critical image ${imageTask.id}`);
            
            const readyTask = await waitForImage(updatedTask, waitTime);
            
            if (readyTask.status === 'ready') {
              console.log(`Image ${imageTask.id} ready after waiting`);
              onImageReady(readyTask);
              this.streamingState.readyImages.push(readyTask);
              this.streamingState.pendingImages.splice(i, 1);
            } else {
              console.log(`Image ${imageTask.id} still not ready after waiting, deferring`);
              // Mark as deferred and update estimated position
              updatedTask.deferred = true;
              updatedTask.deferredFromPosition = currentPos;
              this.streamingState.pendingImages[i] = updatedTask;
            }
          } else {
            console.log(`Skipping wait for image ${imageTask.id}, will try later`);
            // Update the task in pending images without waiting
            this.streamingState.pendingImages[i] = updatedTask;
          }
        } else {
          // Image failed or timed out
          console.log(`Image ${imageTask.id} failed: ${updatedTask.error}`);
          this.streamingState.pendingImages.splice(i, 1);
        }
      }
    }
  }

  /**
   * Determines if an image should be inserted at the current position
   */
  shouldInsertImageNow(imageTask, currentPosition) {
    const streamedText = this.streamingState.streamedContent;
    
    // Strategy 1: Insert based on estimated position
    if (imageTask.estimatedPosition && currentPosition >= imageTask.estimatedPosition) {
      // Check if we're at a good insertion point (sentence boundary)
      return this.isGoodInsertionPoint(streamedText);
    }

    // Strategy 2: Insert based on text content matching
    if (imageTask.insertAfterText) {
      const searchText = imageTask.insertAfterText.toLowerCase();
      const streamedTextLower = streamedText.toLowerCase();
      
      if (streamedTextLower.includes(searchText)) {
        return this.isGoodInsertionPoint(streamedText);
      }
    }

    // Strategy 3: Topic-based insertion - look for relevant keywords
    if (imageTask.keywords && imageTask.keywords.length > 0) {
      const keywordMatches = imageTask.keywords.filter(keyword => 
        streamedText.toLowerCase().includes(keyword.toLowerCase())
      );
      
      if (keywordMatches.length >= Math.ceil(imageTask.keywords.length / 2)) {
        return this.isGoodInsertionPoint(streamedText);
      }
    }

    // Strategy 4: Insert based on character count thresholds with sentence boundaries
    const isAtThreshold = (
      (imageTask.placementHint === 'early' && currentPosition >= 100) ||
      (imageTask.placementHint === 'middle' && currentPosition >= 300) ||
      (imageTask.placementHint === 'late' && currentPosition >= 600)
    );
    
    if (isAtThreshold) {
      return this.isGoodInsertionPoint(streamedText);
    }

    // Strategy 5: Priority-based insertion for high priority images
    if (imageTask.priority === 'high' && currentPosition >= 80) {
      return this.isGoodInsertionPoint(streamedText);
    }

    // Strategy 6: Paragraph break detection
    if (streamedText.endsWith('\n\n') && currentPosition >= 50) {
      return true;
    }

    return false;
  }

  /**
   * Determines if the current position is a good place to insert an image
   */
  isGoodInsertionPoint(streamedText) {
    // Prefer insertion after sentence endings
    if (streamedText.match(/[.!?]\s*$/)) {
      return true;
    }
    
    // Allow insertion after paragraph breaks
    if (streamedText.endsWith('\n\n')) {
      return true;
    }
    
    // Allow insertion after colons (often before explanations)
    if (streamedText.match(/:\s*$/)) {
      return true;
    }
    
    // Avoid insertion in the middle of sentences unless necessary
    const lastSentence = streamedText.split(/[.!?]/).pop();
    if (lastSentence && lastSentence.trim().length < 20) {
      return true; // Short fragment, probably safe to insert
    }
    
    return false;
  }

  /**
   * Calculates how long to wait for an image based on priority and context
   */
  calculateWaitTime(imageTask, currentPosition) {
    let baseWaitTime = 5000; // 5 seconds default
    
    // Adjust based on priority
    if (imageTask.priority === 'high') {
      baseWaitTime = 12000; // 12 seconds for high priority
    } else if (imageTask.priority === 'medium') {
      baseWaitTime = 8000; // 8 seconds for medium priority
    } else if (imageTask.priority === 'low') {
      baseWaitTime = 3000; // 3 seconds for low priority
    }
    
    // Reduce wait time if we're far into the response
    if (currentPosition > 800) {
      baseWaitTime *= 0.5; // Reduce by half for late insertions
    } else if (currentPosition > 400) {
      baseWaitTime *= 0.75; // Reduce by quarter for mid insertions
    }
    
    // Increase wait time for critical images
    if (imageTask.critical) {
      baseWaitTime *= 1.5;
    }
    
    // Reduce wait time for deferred images (second attempt)
    if (imageTask.deferred) {
      baseWaitTime *= 0.6;
    }
    
    return Math.max(1000, Math.min(baseWaitTime, 15000)); // Between 1-15 seconds
  }

  /**
   * Determines whether we should wait for an image or continue streaming
   */
  shouldWaitForImage(imageTask, currentPosition) {
    // Always wait for critical images
    if (imageTask.critical) {
      return true;
    }
    
    // Always wait for high priority images early in the response
    if (imageTask.priority === 'high' && currentPosition < 300) {
      return true;
    }
    
    // Don't wait for low priority images late in the response
    if (imageTask.priority === 'low' && currentPosition > 600) {
      return false;
    }
    
    // Don't wait too long for deferred images
    if (imageTask.deferred && currentPosition - imageTask.deferredFromPosition > 200) {
      return false;
    }
    
    // Check if this is the only remaining image - worth waiting for
    const remainingImages = this.streamingState.pendingImages.length;
    if (remainingImages === 1) {
      return true;
    }
    
    // Default: wait for medium and high priority, skip low priority
    return imageTask.priority !== 'low';
  }

  /**
   * Handles any remaining images after streaming is complete
   */
  async handleRemainingImages(onImageReady) {
    console.log(`Handling ${this.streamingState.pendingImages.length} remaining images`);
    
    for (const imageTask of this.streamingState.pendingImages) {
      const updatedTask = await checkImageStatus(imageTask);
      
      if (updatedTask.status === 'ready') {
        console.log(`Final image ${imageTask.id} ready, inserting`);
        onImageReady(updatedTask);
      } else if (updatedTask.status === 'generating') {
        // Wait a bit more for remaining images
        const readyTask = await waitForImage(updatedTask, 15000);
        if (readyTask.status === 'ready') {
          console.log(`Final image ${imageTask.id} ready after final wait`);
          onImageReady(readyTask);
        }
      }
    }
  }

  /**
   * Builds the streaming prompt based on the response plan
   */
  buildStreamingPrompt(userMessage, conversationHistory, responsePlan) {
    let prompt = userMessage;
    
    if (responsePlan.needsImages && responsePlan.images) {
      prompt += `\n\nNote: This response will include ${responsePlan.totalImages} images showing: `;
      prompt += responsePlan.images.map(img => img.description).join(', ');
      prompt += '. Structure your response to naturally accommodate these visual elements.';
    }

    return prompt;
  }

  /**
   * Stops the current streaming
   */
  stopStreaming() {
    this.streamingState.isStreaming = false;
  }
}

export default StreamingService;