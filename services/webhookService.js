/**
 * Webhook Service for handling file processing and AI generation
 */

const WEBHOOK_BASE_URL = 'https://matrixai212.app.n8n.cloud/webhook/aea0cafd-493a-4217-a29c-501a11cccbb8';

/**
 * Generate a unique UID for requests
 */
const generateUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Process image understanding
 * @param {string} imageUrl - URL of the uploaded image
 * @param {string} prompt - Optional prompt for image analysis
 * @returns {Promise<string>} - Processed response
 */
export const processImageUnderstanding = async (imageUrl, prompt = "Can you see what is in this image") => {
  try {
    const requestBody = {
      messages: [
        {
          uid: generateUID(),
          type: "image",
          text: {
            body: prompt
          },
          url: imageUrl
        }
      ],
      stream: true
    };

    const response = await fetch(WEBHOOK_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Check if response.body exists and has getReader method (React Native compatibility)
    if (!response.body || typeof response.body.getReader !== 'function') {
      // Fallback for React Native - use response.text() instead
      const result = await response.text();
      return parseWebhookResponse(result);
    }

    // Handle streaming response for environments that support it
    try {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let result = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        result += chunk;
      }

      return parseWebhookResponse(result);
    } catch (streamError) {
      console.warn('Streaming failed, falling back to text response:', streamError);
      // Fallback to regular text response
      const result = await response.text();
      return parseWebhookResponse(result);
    }
  } catch (error) {
    console.error('Error processing image understanding:', error);
    throw error;
  }
};

/**
 * Parse webhook response to extract content from JSON lines
 * @param {string} rawResponse - Raw response from webhook
 * @returns {string} - Parsed content
 */
const parseWebhookResponse = (rawResponse) => {
  if (!rawResponse) return '';
  
  let fullContent = '';
  const lines = rawResponse.split('\n');
  
  for (const line of lines) {
    if (line.trim()) {
      try {
        const jsonData = JSON.parse(line);
        
        if (jsonData.type === 'item' && jsonData.content) {
          let content = jsonData.content;
          
          // Filter out common system messages and static content
          const systemPatterns = [
            /^(Processing|Analyzing|Loading|Uploading|Please wait|System:|Assistant:)/i,
            /^(I'm analyzing|I'm processing|Let me analyze|Let me process)/i,
            /^(Starting|Initializing|Preparing)/i
          ];
          
          // Check if this content contains only system messages
          const isSystemMessage = systemPatterns.some(pattern => 
            pattern.test(content.trim())
          );
          
          // Only add content that's not a system message
          if (!isSystemMessage) {
            fullContent += content;
          }
        } else if (jsonData.type === 'end') {
          break;
        }
      } catch (parseError) {
        // Handle non-JSON lines or other formats
        if (line.includes('data: ')) {
          const content = line.replace('data: ', '').trim();
          if (content && content !== '[DONE]') {
            try {
              const parsed = JSON.parse(content);
              if (parsed.content) {
                fullContent += parsed.content;
              }
            } catch {
              // If it's not JSON, treat as plain text
              fullContent += content;
            }
          }
        } else if (!line.startsWith('{') && line.trim().length > 0) {
          // Handle plain text responses
          fullContent += line + '\n';
        }
      }
    }
  }
  
  return fullContent.trim() || rawResponse; // Fallback to raw response if no content extracted
};

/**
 * Process document (PDF, TXT, JSON, XLS, CSV, DOCX)
 * @param {string} documentUrl - URL of the uploaded document
 * @param {string} prompt - Optional prompt for document analysis
 * @returns {Promise<string>} - Processed response
 */
export const processDocument = async (documentUrl, prompt = "Can you perform as a ocr and extract all the text if this file") => {
  try {
    const requestBody = {
      messages: [
        {
          uid: generateUID(),
          type: "document",
          text: {
            body: prompt
          },
          url: documentUrl
        }
      ],
      stream: true
    };

    const response = await fetch(WEBHOOK_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Check if response.body exists and has getReader method (React Native compatibility)
    if (!response.body || typeof response.body.getReader !== 'function') {
      // Fallback for React Native - use response.text() instead
      const result = await response.text();
      return parseWebhookResponse(result);
    }

    // Handle streaming response for environments that support it
    try {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let result = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        result += chunk;
      }

      return parseWebhookResponse(result);
    } catch (streamError) {
      console.warn('Streaming failed, falling back to text response:', streamError);
      // Fallback to regular text response
      const result = await response.text();
      return parseWebhookResponse(result);
    }
  } catch (error) {
    console.error('Error processing document:', error);
    throw error;
  }
};

/**
 * Generate image
 * @param {string} prompt - Prompt for image generation
 * @returns {Promise<string>} - Generated image response
 */
export const generateImage = async (prompt) => {
  try {
    const requestBody = {
      messages: [
        {
          uid: generateUID(),
          type: "image_generate",
          text: {
            body: prompt
          }
        }
      ],
      stream: true
    };

    const response = await fetch(WEBHOOK_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Check if response.body exists and has getReader method (React Native compatibility)
    if (!response.body || typeof response.body.getReader !== 'function') {
      // Fallback for React Native - use response.text() instead
      const result = await response.text();
      return parseWebhookResponse(result);
    }

    // Handle streaming response for environments that support it
    try {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let result = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        result += chunk;
      }

      return parseWebhookResponse(result);
    } catch (streamError) {
      console.warn('Streaming failed, falling back to text response:', streamError);
      // Fallback to regular text response
      const result = await response.text();
      return parseWebhookResponse(result);
    }
  } catch (error) {
    console.error('Error generating image:', error);
    throw error;
  }
};

/**
 * Generate XLSX spreadsheet
 * @param {string} prompt - Prompt for spreadsheet generation
 * @returns {Promise<string>} - Generated spreadsheet response
 */
export const generateXLSX = async (prompt) => {
  try {
    const requestBody = {
      messages: [
        {
          uid: generateUID(),
          type: "sheet_generate",
          text: {
            body: prompt
          }
        }
      ],
      stream: false
    };

    const response = await fetch(WEBHOOK_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Handle simple text response
    const result = await response.text();
    return parseWebhookResponse(result);
  } catch (error) {
    console.error('Error generating XLSX:', error);
    throw error;
  }
};

/**
 * Generate DOC document
 * @param {string} prompt - Prompt for document generation
 * @returns {Promise<string>} - Generated document response
 */
export const generateDOC = async (prompt) => {
  try {
    const requestBody = {
      messages: [
        {
          uid: generateUID(),
          type: "document_generate",
          text: {
            body: prompt
          }
        }
      ],
      stream: false
    };

    const response = await fetch(WEBHOOK_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Handle simple text response
    const result = await response.text();
    return parseWebhookResponse(result);
  } catch (error) {
    console.error('Error generating DOC:', error);
    throw error;
  }
};

/**
 * Determine file type based on MIME type or file extension
 * @param {string} mimeType - MIME type of the file
 * @param {string} fileName - Name of the file
 * @returns {string} - File type category
 */
export const getFileTypeCategory = (mimeType, fileName) => {
  const imageTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 
    'image/webp', 'image/bmp', 'image/svg+xml'
  ];
  
  const documentTypes = [
    'application/pdf', 'text/plain', 'application/json',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword' // .doc
  ];

  if (imageTypes.includes(mimeType)) {
    return 'image';
  } else if (documentTypes.includes(mimeType)) {
    return 'document';
  }

  // Fallback to file extension
  if (fileName) {
    const extension = fileName.toLowerCase().split('.').pop();
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
    const documentExtensions = ['pdf', 'txt', 'json', 'xlsx', 'xls', 'csv', 'docx', 'doc'];
    
    if (imageExtensions.includes(extension)) {
      return 'image';
    } else if (documentExtensions.includes(extension)) {
      return 'document';
    }
  }

  return 'unknown';
};