// Import webhook service for file type detection
import { getFileTypeCategory } from '../services/webhookService';

// Utility function to parse bot messages and extract file attachments
export const parseMessageForAttachments = (messageText) => {
  if (!messageText || typeof messageText !== 'string') {
    return { cleanText: messageText || '', attachments: [] };
  }

  // Regular expressions to match different file URL patterns - expanded for new file types
  const urlPatterns = [
    // General URL pattern for common file extensions - prioritize modern formats and add new types
    /https?:\/\/[^\s<>"{}|\\^`\[\]]+\.(pdf|docx|xlsx|pptx|doc|xls|ppt|txt|csv|json|zip|rar|jpg|jpeg|png|gif|webp|heic|heif|mp4|avi|mov|mp3|wav|m4a|flac)(\?[^\s<>"{}|\\^`\[\]]*)?/gi,
    // Supabase storage URLs
    /https?:\/\/[^\s<>"{}|\\^`\[\]]*supabase\.co\/storage\/v1\/[^\s<>"{}|\\^`\[\]]*/gi,
    // Google Drive/Docs URLs
    /https?:\/\/[^\s<>"{}|\\^`\[\]]*(?:drive\.google\.com|docs\.google\.com)\/[^\s<>"{}|\\^`\[\]]*/gi,
    // Dropbox URLs
    /https?:\/\/[^\s<>"{}|\\^`\[\]]*dropbox\.com\/[^\s<>"{}|\\^`\[\]]*/gi,
    // OneDrive URLs
    /https?:\/\/[^\s<>"{}|\\^`\[\]]*(?:onedrive\.live\.com|1drv\.ms)\/[^\s<>"{}|\\^`\[\]]*/gi,
  ];

  let cleanText = messageText;
  const attachments = [];
  const foundUrls = new Set(); // To avoid duplicates
  const processedFiles = new Map(); // To track files by base name and prioritize modern formats

  // Extract URLs using all patterns
  urlPatterns.forEach(pattern => {
    const matches = messageText.match(pattern);
    if (matches) {
      matches.forEach(url => {
        if (!foundUrls.has(url)) {
          foundUrls.add(url);
          
          // Extract filename and file type
          const attachment = extractFileInfo(url);
          if (attachment) {
            // Create a base filename without extension for duplicate detection
            const baseName = attachment.filename.replace(/\.[^/.]+$/, '');
            const fileType = attachment.fileType.toLowerCase();
            
            // Check if we already have this file in a different format
            const existingAttachment = processedFiles.get(baseName);
            
            if (existingAttachment) {
              // Prioritize modern formats: DOCX over DOC, XLSX over XLS
              const shouldReplace = 
                (existingAttachment.fileType === 'doc' && fileType === 'docx') ||
                (existingAttachment.fileType === 'xls' && fileType === 'xlsx') ||
                (existingAttachment.fileType === 'ppt' && fileType === 'pptx');
              
              if (shouldReplace) {
                // Remove the old attachment and add the new one
                const oldIndex = attachments.findIndex(att => att.filename === existingAttachment.filename);
                if (oldIndex !== -1) {
                  attachments.splice(oldIndex, 1);
                }
                attachments.push(attachment);
                processedFiles.set(baseName, attachment);
              }
              // If the existing format is already modern, skip the old format
            } else {
              // No duplicate found, add the attachment
              attachments.push(attachment);
              processedFiles.set(baseName, attachment);
            }
            
            // Remove the URL from the clean text
            cleanText = cleanText.replace(url, '').trim();
          }
        }
      });
    }
  });

  // Clean up extra whitespace and line breaks
  cleanText = cleanText
    .replace(/\n\s*\n/g, '\n') // Remove multiple consecutive line breaks
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim();

  return {
    cleanText,
    attachments
  };
};

// Helper function to extract file information from URL
const extractFileInfo = (url) => {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const searchParams = urlObj.searchParams;
    
    // Extract filename from URL path
    let filename = pathname.split('/').pop();
    
    // Handle special cases for different services
    if (url.includes('supabase.co')) {
      // Supabase storage URLs might have the filename in the path
      const pathParts = pathname.split('/');
      filename = pathParts[pathParts.length - 1];
    } else if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
      // Google Drive URLs - try to extract from URL or use generic name
      filename = searchParams.get('title') || 'Google Drive Document';
    } else if (url.includes('dropbox.com')) {
      // Dropbox URLs
      filename = pathname.split('/').pop() || 'Dropbox File';
    } else if (url.includes('onedrive.live.com') || url.includes('1drv.ms')) {
      // OneDrive URLs
      filename = 'OneDrive Document';
    }

    // Remove URL parameters from filename if present
    if (filename && filename.includes('?')) {
      filename = filename.split('?')[0];
    }

    // Extract file extension
    let fileType = '';
    if (filename && filename.includes('.')) {
      fileType = filename.split('.').pop().toLowerCase();
    } else {
      // Try to determine file type from URL - expanded for new file types
      const urlLower = url.toLowerCase();
      if (urlLower.includes('.pdf')) fileType = 'pdf';
      else if (urlLower.includes('.doc')) fileType = urlLower.includes('.docx') ? 'docx' : 'doc';
      else if (urlLower.includes('.xls')) fileType = urlLower.includes('.xlsx') ? 'xlsx' : 'xls';
      else if (urlLower.includes('.ppt')) fileType = urlLower.includes('.pptx') ? 'pptx' : 'ppt';
      else if (urlLower.includes('.txt')) fileType = 'txt';
      else if (urlLower.includes('.csv')) fileType = 'csv';
      else if (urlLower.includes('.json')) fileType = 'json';
      else if (urlLower.includes('.zip')) fileType = 'zip';
      else if (urlLower.includes('.rar')) fileType = 'rar';
      else if (urlLower.includes('.jpg') || urlLower.includes('.jpeg')) fileType = 'jpg';
      else if (urlLower.includes('.png')) fileType = 'png';
      else if (urlLower.includes('.gif')) fileType = 'gif';
      else if (urlLower.includes('.webp')) fileType = 'webp';
      else if (urlLower.includes('.heic')) fileType = 'heic';
      else if (urlLower.includes('.heif')) fileType = 'heif';
      else if (urlLower.includes('.mp4')) fileType = 'mp4';
      else if (urlLower.includes('.avi')) fileType = 'avi';
      else if (urlLower.includes('.mov')) fileType = 'mov';
      else if (urlLower.includes('.mp3')) fileType = 'mp3';
      else if (urlLower.includes('.wav')) fileType = 'wav';
      else if (urlLower.includes('.m4a')) fileType = 'm4a';
      else if (urlLower.includes('.flac')) fileType = 'flac';
    }

    // If no filename was extracted, create a generic one
    if (!filename || filename === '') {
      filename = `document.${fileType || 'file'}`;
    }

    // Use webhook service to determine file category
    const fileCategory = getFileTypeCategory(fileType ? `application/${fileType}` : '', filename);

    return {
      url,
      filename,
      fileType,
      fileCategory
    };
  } catch (error) {
    console.error('Error parsing URL:', error);
    return null;
  }
};

// Function to check if a message contains file attachments
export const hasAttachments = (messageText) => {
  const { attachments } = parseMessageForAttachments(messageText);
  return attachments.length > 0;
};

// Function to format message text by removing HTML-like tags while preserving content
// Function to detect if text contains HTML tags
const isHtmlContent = (text) => {
  if (!text || typeof text !== 'string') return false;
  
  // Check for common HTML tags (more comprehensive)
  const htmlTagRegex = /<\/?(?:p|div|span|br|h[1-6]|ul|ol|li|strong|b|em|i|u|code|pre|blockquote|a|img)[^>]*>/i;
  
  // Check for HTML entities
  const htmlEntityRegex = /&(?:amp|lt|gt|quot|#39|apos|nbsp|copy|reg|trade|hellip|mdash|ndash|lsquo|rsquo|ldquo|rdquo);/i;
  
  // Check for multiple HTML indicators
  const hasHtmlTags = htmlTagRegex.test(text);
  const hasHtmlEntities = htmlEntityRegex.test(text);
  
  // If it has HTML tags or multiple HTML entities, consider it HTML
  return hasHtmlTags || hasHtmlEntities;
};

// Function to format direct AI text (non-HTML) like ChatGPT
const formatDirectText = (text) => {
  console.log('Direct text formatting input:', text);
  
  if (!text || typeof text !== 'string') {
    return text;
  }

  // Normalize line endings
  let formatted = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Handle special patterns that look like headers or structured content
  formatted = formatted
    // Convert "### Day 1:" style patterns to proper markdown headers
    .replace(/^(#{1,6})\s*([^:]+):\s*$/gm, '$1 $2')
    // Convert "#### Morning:" style patterns
    .replace(/^(#{1,6})\s*([^:]+):\s*$/gm, '$1 $2')
    // Convert standalone patterns like "Day 1:" to headers
    .replace(/^(Day \d+):\s*$/gm, '## $1')
    .replace(/^(Morning|Afternoon|Evening):\s*$/gm, '### $1')
    // Convert patterns like "Here's a detailed 5-day itinerary" to headers
    .replace(/^Here's a detailed (.+)$/gm, '# $1')
    // Handle bullet points and lists - be more aggressive
    .replace(/^[\s]*[-•]\s+/gm, '- ')
    .replace(/^[\s]*\*\s+/gm, '- ')
    .replace(/^[\s]*(\d+)[\.\)]\s+/gm, '$1. ')
    // Convert lines that start with location names followed by colon to subheaders
    .replace(/^([A-Z][^:\n]{2,30}):\s*$/gm, '### $1')
    // Convert lines that describe activities starting with ":" to list items
    .replace(/^:\s*(.+)$/gm, '- $1')
    // Handle bold text patterns
    .replace(/\*\*([^*]+)\*\*/g, '**$1**')
    .replace(/\*([^*]+)\*/g, '*$1*')
    // Add proper spacing around headers
    .replace(/^(#{1,6}\s+.+)$/gm, '\n$1\n')
    // Ensure list items have proper spacing
    .replace(/^(-\s+.+)$/gm, '$1')
    .replace(/^(\d+\.\s+.+)$/gm, '$1');

  // Clean up excessive whitespace but preserve intentional formatting
  formatted = formatted
    .replace(/\n{4,}/g, '\n\n\n') // Max 3 consecutive newlines for spacing
    .replace(/[ \t]+$/gm, '') // Remove trailing spaces
    .replace(/^\n+/, '') // Remove leading newlines
    .replace(/\n+$/, '') // Remove trailing newlines
    .trim();

  console.log('Direct text formatted:', formatted);
  return formatted;
};

export const formatMessageText = (text) => {
  if (!text || typeof text !== 'string') {
    return text || '';
  }

  // Detect if this is HTML content or direct AI text
  const isHtml = isHtmlContent(text);
  
  // For debugging - you can remove this later
  console.log('formatMessageText - isHTML:', isHtml, 'text preview:', text.substring(0, 100));
  
  if (!isHtml) {
    // This is direct AI text, format it like ChatGPT
    const directFormatted = formatDirectText(text);
    console.log('Direct text formatted:', directFormatted.substring(0, 100));
    return directFormatted;
  }

  // This is HTML content, use the existing HTML parsing logic
  console.log('Processing as HTML content');
  let formatted = text;

  // Handle common HTML entities first
  const htmlEntities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™',
    '&hellip;': '...',
    '&mdash;': '—',
    '&ndash;': '–',
    '&lsquo;': "'",
    '&rsquo;': "'",
    '&ldquo;': '"',
    '&rdquo;': '"'
  };

  // Replace HTML entities
  Object.keys(htmlEntities).forEach(entity => {
    const regex = new RegExp(entity, 'gi');
    formatted = formatted.replace(regex, htmlEntities[entity]);
  });

  // Handle line breaks - convert <br>, <br/>, <br /> to actual line breaks
  formatted = formatted.replace(/<br\s*\/?>/gi, '\n');

  // Handle paragraph tags - convert to proper line breaks
  formatted = formatted.replace(/<\/p>\s*<p[^>]*>/gi, '\n\n');
  formatted = formatted.replace(/<p[^>]*>/gi, '');
  formatted = formatted.replace(/<\/p>/gi, '\n\n');

  // Handle headings with proper spacing and formatting
  formatted = formatted.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n\n# $1\n\n');
  formatted = formatted.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n\n## $1\n\n');
  formatted = formatted.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n\n### $1\n\n');
  formatted = formatted.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n\n#### $1\n\n');
  formatted = formatted.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '\n\n##### $1\n\n');
  formatted = formatted.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '\n\n###### $1\n\n');

  // Handle ordered lists with proper numbering
  formatted = formatted.replace(/<ol[^>]*>(.*?)<\/ol>/gis, (match, content) => {
    let counter = 1;
    const listContent = content.replace(/<li[^>]*>(.*?)<\/li>/gi, (liMatch, liContent) => {
      return `\n${counter++}. ${liContent.trim()}`;
    });
    return `\n${listContent}\n`;
  });

  // Handle unordered lists with proper bullet points (markdown format)
  formatted = formatted.replace(/<ul[^>]*>(.*?)<\/ul>/gis, (match, content) => {
    const listContent = content.replace(/<li[^>]*>(.*?)<\/li>/gi, (liMatch, liContent) => {
      return `\n- ${liContent.trim()}`;
    });
    return `\n${listContent}\n`;
  });

  // Handle remaining list items (in case they're not wrapped in ul/ol) - use markdown format
  formatted = formatted.replace(/<li[^>]*>(.*?)<\/li>/gi, '\n- $1');
  formatted = formatted.replace(/<li[^>]*>/gi, '\n- ');
  formatted = formatted.replace(/<\/li>/gi, '');

  // Handle strong/bold tags with proper markdown
  formatted = formatted.replace(/<(strong|b)[^>]*>(.*?)<\/(strong|b)>/gi, '**$2**');

  // Handle emphasis/italic tags
  formatted = formatted.replace(/<(em|i)[^>]*>(.*?)<\/(em|i)>/gi, '*$2*');

  // Handle underline tags
  formatted = formatted.replace(/<u[^>]*>(.*?)<\/u>/gi, '__$1__');

  // Handle code tags
  formatted = formatted.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');

  // Handle pre tags (code blocks)
  formatted = formatted.replace(/<pre[^>]*>(.*?)<\/pre>/gis, '\n```\n$1\n```\n');

  // Handle blockquote tags with proper spacing
  formatted = formatted.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, '\n\n> $1\n\n');

  // Handle div tags with line breaks
  formatted = formatted.replace(/<\/div>\s*<div[^>]*>/gi, '\n');
  formatted = formatted.replace(/<\/?div[^>]*>/gi, '\n');

  // Handle span tags (remove but keep content)
  formatted = formatted.replace(/<\/?span[^>]*>/gi, '');

  // Remove any remaining HTML tags but preserve content
  formatted = formatted.replace(/<\/?[^>]+(>|$)/g, '');

  // Clean up excessive whitespace and line breaks
  formatted = formatted
    .replace(/\n\s*\n\s*\n+/g, '\n\n') // Replace multiple line breaks with double
    .replace(/[ \t]+/g, ' ') // Replace multiple spaces/tabs with single space
    .replace(/^\s+|\s+$/g, '') // Trim leading/trailing whitespace
    .replace(/\n\s+/g, '\n') // Remove spaces at beginning of lines (except after bullets)
    .replace(/\s+\n/g, '\n') // Remove spaces at end of lines
    .replace(/-\s+/g, '- ') // Ensure single space after markdown bullet points
    .replace(/(\d+\.)\s+/g, '$1 '); // Ensure single space after numbered list items

  return formatted;
};

export default {
  parseMessageForAttachments,
  hasAttachments,
  formatMessageText
};