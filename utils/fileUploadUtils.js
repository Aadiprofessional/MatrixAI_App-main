import { supabase } from '../supabaseClient';

// Supported file types and their configurations
export const FILE_TYPES = {
  IMAGE: {
    mimeTypes: [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp',
      'image/bmp',
      'image/svg+xml'
    ],
    maxSize: 5 * 1024 * 1024, // 5MB
    folder: 'images'
  },
  DOCUMENT: {
    mimeTypes: [
      'application/pdf',
      'text/plain',
      'application/json',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword' // .doc
    ],
    maxSize: 10 * 1024 * 1024, // 10MB
    folder: 'documents'
  }
};

/**
 * Validates a file against supported types and size limits
 * @param {Object} file - File object with name, type, and size properties
 * @returns {Object} - Validation result with isValid, fileType, and error message
 */
export const validateFile = (file) => {
  if (!file || !file.type || !file.size) {
    return {
      isValid: false,
      error: 'Invalid file object'
    };
  }

  // Check if it's an image
  if (FILE_TYPES.IMAGE.mimeTypes.includes(file.type)) {
    if (file.size > FILE_TYPES.IMAGE.maxSize) {
      return {
        isValid: false,
        error: `Image file size must be less than ${FILE_TYPES.IMAGE.maxSize / (1024 * 1024)}MB`
      };
    }
    return {
      isValid: true,
      fileType: 'image'
    };
  }

  // Check if it's a document
  if (FILE_TYPES.DOCUMENT.mimeTypes.includes(file.type)) {
    if (file.size > FILE_TYPES.DOCUMENT.maxSize) {
      return {
        isValid: false,
        error: `Document file size must be less than ${FILE_TYPES.DOCUMENT.maxSize / (1024 * 1024)}MB`
      };
    }
    return {
      isValid: true,
      fileType: 'document'
    };
  }

  return {
    isValid: false,
    error: 'Unsupported file type'
  };
};

/**
 * Generates a unique filename with timestamp and random string
 * @param {string} originalName - Original filename
 * @param {string} userId - User ID for uniqueness
 * @returns {string} - Unique filename
 */
export const generateUniqueFileName = (originalName, userId) => {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const extension = originalName.split('.').pop();
  return `${timestamp}_${randomString}_${userId}.${extension}`;
};

/**
 * Uploads a file to Supabase storage
 * @param {Object} file - File object (React Native file picker format)
 * @param {string} userId - User ID
 * @param {string} fileType - 'image' or 'document'
 * @returns {Promise<Object>} - Upload result with file info and public URL
 */
export const uploadFileToStorage = async (file, userId, fileType) => {
  try {
    console.log('uploadFileToStorage called with:', { file, userId, fileType });
    
    // Generate unique filename
    const fileName = generateUniqueFileName(file.name || file.fileName, userId);
    const folderPath = fileType === 'image' ? 'images' : 'documents';
    const filePath = `users/${userId}/${folderPath}/${fileName}`;

    console.log('File path:', filePath);
    console.log('File object:', file);

    // Prepare file data for upload
    let fileData;
    if (file.uri) {
      console.log('Processing React Native file with URI:', file.uri);
      
      try {
        // For React Native, use a simpler approach with fetch
        // This works better with both regular URIs and file:// URIs
        let response;
        
        try {
          // Try direct fetch first
          response = await fetch(file.uri);
          if (!response.ok) {
            throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
          }
        } catch (fetchError) {
          console.log('Direct fetch failed, trying with file:// protocol');
          // If direct fetch fails, ensure file:// protocol
          const fileUri = file.uri.startsWith('file://') ? file.uri : `file://${file.uri}`;
          response = await fetch(fileUri);
          if (!response.ok) {
            throw new Error(`File fetch failed: ${response.status} ${response.statusText}`);
          }
        }
        
        // Get the blob data
        fileData = await response.blob();
        console.log('Fetch blob created, size:', fileData.size, 'type:', fileData.type);
        
        // Verify blob has content
        if (!fileData || fileData.size === 0) {
          console.error('Blob is empty after creation from URI');
          throw new Error('Failed to create blob from file URI - blob is empty');
        }
        
      } catch (uriError) {
        console.error('Error processing file URI:', uriError);
        throw new Error(`Failed to process file URI: ${uriError.message}`);
      }
    } else if (file instanceof Blob) {
      console.log('File is already a Blob, size:', file.size);
      fileData = file;
      
      if (fileData.size === 0) {
        throw new Error('Blob file is empty');
      }
    } else if (file.data) {
      // Handle base64 data
      console.log('Processing base64 data');
      const base64Data = file.data.split(',')[1] || file.data;
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      fileData = new Blob([byteArray], { type: file.type || 'application/octet-stream' });
    } else {
      console.error('Unsupported file format, file object:', file);
      throw new Error('Unsupported file format - no URI, Blob, or data property found');
    }

    if (!fileData || fileData.size === 0) {
      console.error('File data is empty or null:', fileData);
      throw new Error('File data is empty or null');
    }

    // Determine content type
    const contentType = file.type || file.mime || fileData.type || 'application/octet-stream';
    console.log('Using content type:', contentType);
    console.log('Final fileData before upload - size:', fileData.size, 'type:', fileData.type);

    // Verify we have valid file data before uploading
    if (!fileData || fileData.size === 0) {
      console.error('FileData is invalid before upload:', { fileData, size: fileData?.size });
      throw new Error('File data is empty or invalid before upload');
    }

    // Upload to Supabase storage
    console.log('Uploading to Supabase storage with path:', filePath);
    const { data, error } = await supabase.storage
      .from('user-uploads')
      .upload(filePath, fileData, {
        cacheControl: '3600',
        upsert: false,
        contentType: contentType
      });

    if (error) {
      console.error('Supabase upload error:', error);
      throw error;
    }

    console.log('Supabase upload successful:', data);

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('user-uploads')
      .getPublicUrl(filePath);

    return {
      fileName,
      filePath,
      publicUrl,
      fileType,
      originalName: file.name || file.fileName,
      size: file.size || file.fileSize,
      mimeType: file.type || file.mime
    };

  } catch (error) {
    console.error('Error uploading file to storage:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
};

/**
 * Simple file upload function that only saves to Supabase storage and returns URL
 * @param {Object} file - File object with uri, type, name, size
 * @param {string} userId - User ID for folder organization
 * @returns {Promise<Object>} - Upload result with publicUrl
 */
export const simpleUploadToStorage = async (file, userId) => {
  try {
    console.log('simpleUploadToStorage called with:', { file, userId });
    
    // Generate unique filename
    const fileName = generateUniqueFileName(file.name || file.fileName || 'file', userId);
    const filePath = `users/${userId}/uploads/${fileName}`;
    
    console.log('Simple upload - File path:', filePath);
    
    // Get file data
    let fileData;
    if (file.uri) {
      // Use fetch to get file data as ArrayBuffer for React Native compatibility
      const response = await fetch(file.uri);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status}`);
      }
      fileData = await response.arrayBuffer();
    } else if (file instanceof Blob) {
      fileData = await file.arrayBuffer();
    } else if (file instanceof ArrayBuffer) {
      fileData = file;
    } else {
      throw new Error('Unsupported file format');
    }
    
    if (!fileData || fileData.byteLength === 0) {
      throw new Error('File data is empty');
    }
    
    console.log('Simple upload - File data size:', fileData.byteLength);
    
    // Upload to Supabase
    const { data, error } = await supabase.storage
      .from('user-uploads')
      .upload(filePath, fileData, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'application/octet-stream'
      });
    
    if (error) {
      console.error('Simple upload error:', error);
      throw error;
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('user-uploads')
      .getPublicUrl(filePath);
    
    console.log('Simple upload successful, URL:', publicUrl);
    
    return {
      publicUrl,
      fileName,
      filePath,
      originalName: file.name || file.fileName,
      size: file.size || fileData.byteLength
    };
    
  } catch (error) {
    console.error('Simple upload failed:', error);
    throw new Error(`Upload failed: ${error.message}`);
  }
};

/**
 * Converts blob URL to base64 for processing
 * @param {string} blobUrl - Blob URL
 * @returns {Promise<string>} - Base64 data URL
 */
export const blobUrlToBase64 = async (blobUrl) => {
  try {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting blob URL to base64:', error);
    throw error;
  }
};

/**
 * Gets file extension from filename
 * @param {string} filename - Filename
 * @returns {string} - File extension
 */
export const getFileExtension = (filename) => {
  return filename.split('.').pop().toLowerCase();
};

/**
 * Checks if file is a PDF
 * @param {Object} file - File object
 * @returns {boolean} - True if PDF
 */
export const isPDF = (file) => {
  return file.type === 'application/pdf' || getFileExtension(file.name || file.fileName) === 'pdf';
};

/**
 * Checks if file is a Word document
 * @param {Object} file - File object
 * @returns {boolean} - True if Word document
 */
export const isWordDocument = (file) => {
  const wordTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ];
  const wordExtensions = ['doc', 'docx'];
  return wordTypes.includes(file.type) || wordExtensions.includes(getFileExtension(file.name || file.fileName));
};

/**
 * Checks if file is an Excel document
 * @param {Object} file - File object
 * @returns {boolean} - True if Excel document
 */
export const isExcelDocument = (file) => {
  const excelTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv'
  ];
  const excelExtensions = ['xlsx', 'xls', 'csv'];
  return excelTypes.includes(file.type) || excelExtensions.includes(getFileExtension(file.name || file.fileName));
};

/**
 * Formats file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};