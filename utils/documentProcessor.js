// import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

// Configure PDF.js worker
// pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * Processes PDF files by converting pages to images
 * @param {string} fileUri - URI of the PDF file
 * @returns {Promise<Array>} - Array of base64 image strings
 */
export const processPDFDocument = async (fileUri) => {
  // Temporarily disabled due to Babel compatibility issues with pdfjs-dist
  console.log('PDF processing temporarily disabled:', fileUri);
  throw new Error('PDF processing is temporarily disabled. Please use Word or Excel files instead.');
  
  /* 
  try {
    console.log('Processing PDF document:', fileUri);
    
    // Read file as array buffer
    let arrayBuffer;
    if (fileUri.startsWith('file://')) {
      const base64Data = await RNFS.readFile(fileUri.replace('file://', ''), 'base64');
      arrayBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0)).buffer;
    } else {
      const response = await fetch(fileUri);
      arrayBuffer = await response.arrayBuffer();
    }
    
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Load PDF document
    const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;
    
    const pages = [];
    
    // Process each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      
      // Set up canvas for rendering
      const scale = 2.0; // Higher scale for better quality
      const viewport = page.getViewport({ scale });
      
      // Create canvas
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      // Render page to canvas
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
      
      // Convert canvas to base64 image
      const imageData = canvas.toDataURL('image/png');
      pages.push(imageData);
    }
    
    console.log(`Successfully processed PDF: ${pages.length} pages`);
    return pages;
    
  } catch (error) {
    console.error('Error processing PDF document:', error);
    throw new Error(`Failed to process PDF: ${error.message}`);
  }
  */
};

/**
 * Processes Word documents (DOC/DOCX) by extracting content
 * @param {string} fileUri - Local file URI
 * @returns {Promise<Object>} - Extracted content with text and images
 */
export const processWordDocument = async (fileUri) => {
  try {
    console.log('Processing Word document:', fileUri);
    
    // Read file as buffer
    const fileData = await RNFS.readFile(fileUri, 'base64');
    const buffer = Buffer.from(fileData, 'base64');

    // Extract content using mammoth
    const result = await mammoth.convertToHtml({ buffer });
    
    // Extract images if present
    const images = [];
    if (result.messages) {
      result.messages.forEach(message => {
        if (message.type === 'warning' && message.message.includes('image')) {
          // Handle image extraction warnings
          console.log('Image extraction warning:', message.message);
        }
      });
    }

    return {
      html: result.value,
      text: result.value.replace(/<[^>]*>/g, ''), // Strip HTML tags for plain text
      images: images,
      warnings: result.messages || []
    };
  } catch (error) {
    console.error('Error processing Word document:', error);
    throw new Error(`Failed to process Word document: ${error.message}`);
  }
};

/**
 * Processes Excel files by sending to webhook API
 * @param {string} fileUrl - Public URL of the uploaded file
 * @param {Function} onChunk - Callback for streaming response chunks
 * @returns {Promise<string>} - Processed content
 */
export const processExcelDocument = async (fileUrl, onChunk) => {
  try {
    console.log('Processing Excel document via webhook:', fileUrl);
    
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://matrixai21.app.n8n.cloud/webhook/910d8b7e-6462-463b-90ef-42056a296c73');
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Accept', 'text/event-stream');

      let fullContent = '';
      let processedLength = 0;

      xhr.onreadystatechange = function() {
        if (xhr.readyState === XMLHttpRequest.LOADING || xhr.readyState === XMLHttpRequest.DONE) {
          const responseText = xhr.responseText;
          const newContent = responseText.substring(processedLength);
          processedLength = responseText.length;

          if (newContent) {
            const lines = newContent.split('\n');
            
            for (const line of lines) {
              if (line.trim()) {
                try {
                  const jsonData = JSON.parse(line);
                  
                  if (jsonData.type === 'item' && jsonData.content) {
                    fullContent += jsonData.content;
                    if (onChunk) {
                      onChunk(jsonData.content);
                    }
                  } else if (jsonData.type === 'end') {
                    resolve(fullContent);
                    return;
                  }
                } catch (parseError) {
                  // Handle non-JSON lines
                  if (line.includes('data: ')) {
                    const content = line.replace('data: ', '').trim();
                    if (content && content !== '[DONE]') {
                      fullContent += content;
                      if (onChunk) {
                        onChunk(content);
                      }
                    }
                  }
                }
              }
            }
          }
        }
      };

      xhr.onerror = function() {
        reject(new Error('Network error while processing Excel document'));
      };

      xhr.ontimeout = function() {
        reject(new Error('Timeout while processing Excel document'));
      };

      xhr.timeout = 60000; // 60 second timeout

      const requestBody = JSON.stringify({
        fileUrl: fileUrl,
        fileType: 'excel'
      });

      xhr.send(requestBody);
    });
  } catch (error) {
    console.error('Error processing Excel document:', error);
    throw new Error(`Failed to process Excel document: ${error.message}`);
  }
};

/**
 * Determines the appropriate processing method for a file
 * @param {Object} file - File object with type information
 * @returns {string} - Processing method: 'pdf', 'word', 'excel', or 'none'
 */
export const getDocumentProcessingMethod = (file) => {
  const mimeType = file.type || file.mime;
  const fileName = file.name || file.fileName;
  const extension = fileName ? fileName.split('.').pop().toLowerCase() : '';

  // PDF files (temporarily disabled)
  if (mimeType === 'application/pdf' || extension === 'pdf') {
    return 'none'; // Temporarily disabled
  }

  // Word documents
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
      mimeType === 'application/msword' || 
      extension === 'docx' || 
      extension === 'doc') {
    return 'word';
  }

  // Excel documents
  if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel' ||
      mimeType === 'text/csv' ||
      extension === 'xlsx' ||
      extension === 'xls' ||
      extension === 'csv') {
    return 'excel';
  }

  return 'none';
};

/**
 * Main document processing function that routes to appropriate processor
 * @param {Object} file - File object
 * @param {string} fileUri - Local file URI
 * @param {string} fileUrl - Public file URL (for Excel processing)
 * @param {Function} onChunk - Callback for streaming content
 * @returns {Promise<Object>} - Processed document content
 */
export const processDocument = async (file, fileUri, fileUrl, onChunk) => {
  const processingMethod = getDocumentProcessingMethod(file);

  switch (processingMethod) {
    case 'pdf':
      const pdfPages = await processPDFDocument(fileUri);
      return {
        type: 'pdf',
        pages: pdfPages,
        pageCount: pdfPages.length
      };

    case 'word':
      const wordContent = await processWordDocument(fileUri);
      return {
        type: 'word',
        html: wordContent.html,
        text: wordContent.text,
        images: wordContent.images,
        warnings: wordContent.warnings
      };

    case 'excel':
      const excelContent = await processExcelDocument(fileUrl, onChunk);
      return {
        type: 'excel',
        content: excelContent
      };

    default:
      throw new Error(`Unsupported document type for processing: ${file.type || 'unknown'}`);
  }
};