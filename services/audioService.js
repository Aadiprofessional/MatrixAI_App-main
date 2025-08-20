import { supabase } from '../supabaseClient';

/**
 * @typedef {Object} WordData
 * @property {string} word - The transcribed word
 * @property {number} start - Start time of the word in seconds
 * @property {number} end - End time of the word in seconds
 * @property {number} confidence - Confidence score of the transcription
 * @property {string} punctuated_word - Word with punctuation
 */

/**
 * @typedef {Object} AudioFile
 * @property {string} audioid - Unique identifier for the audio file
 * @property {string} audio_url - URL to access the audio file
 * @property {('pending'|'processing'|'completed'|'failed')} status - Current status of the audio processing
 * @property {number} duration - Duration of the audio in seconds
 * @property {string} uploaded_at - Timestamp when the audio was uploaded
 * @property {string} [transcription] - Transcription text if available
 * @property {WordData[]} [words_data] - Detailed word timing data if available
 * @property {string} [language] - Language of the audio
 * @property {string} [error_message] - Error message if processing failed
 */

/**
 * @typedef {Object} AudioUploadResponse
 * @property {boolean} success - Whether the upload was successful
 * @property {string} audioid - Unique identifier for the uploaded audio
 * @property {string} status - Status of the upload
 * @property {string} [transcription] - Transcription if immediately available
 * @property {string} message - Success or error message
 * @property {string} [error_message] - Detailed error message if failed
 */

/**
 * @typedef {Object} AudioStatusResponse
 * @property {boolean} success - Whether the status check was successful
 * @property {string} audioid - Unique identifier for the audio
 * @property {string} status - Current status of the audio processing
 * @property {string} [error_message] - Error message if status check failed
 */

/**
 * @typedef {Object} AudioFileResponse
 * @property {boolean} success - Whether the file retrieval was successful
 * @property {string} audioid - Unique identifier for the audio
 * @property {string} status - Current status of the audio
 * @property {string} audioUrl - URL to access the audio file
 * @property {string} [transcription] - Transcription text if available
 * @property {WordData[]} [words_data] - Detailed word timing data if available
 * @property {string} [language] - Language of the audio
 * @property {number} [duration] - Duration of the audio in seconds
 * @property {string} uploaded_at - Timestamp when the audio was uploaded
 * @property {string} [error_message] - Error message if retrieval failed
 */

/**
 * @typedef {Object} AudioListResponse
 * @property {boolean} success - Whether the listing was successful
 * @property {AudioFile[]} audioFiles - Array of audio files
 */

/**
 * @typedef {Object} AudioFileData
 * @property {string} audioid - Unique identifier for the audio
 * @property {number} duration - Duration of the audio in seconds
 * @property {string} uploaded_at - Timestamp when the audio was uploaded
 * @property {string} audio_name - Name of the audio file
 * @property {string} audio_url - URL to access the audio file
 * @property {string} language - Language of the audio
 */

/**
 * @typedef {Object} AudioDataResponse
 * @property {AudioFileData[]} audioData - Array of audio file data
 */

/**
 * @typedef {Object} AudioRemoveResponse
 * @property {string} message - Success or error message
 */

/**
 * @typedef {Object} AudioEditResponse
 * @property {string} message - Success or error message
 * @property {Object} updatedAudio - Updated audio information
 */

/**
 * @typedef {Object} XmlGraphResponse
 * @property {string} message - Success or error message
 * @property {Object} data - Response data
 */

const API_BASE_URL = 'https://main-matrixai-server-lujmidrakh.cn-hangzhou.fcapp.run';

export const audioService = { 
  /**
   * Upload audio URL for transcription
   * @param {string} uid - User ID
   * @param {string} audioUrl - URL of the audio file
   * @param {string} [language='en-GB'] - Language code
   * @param {number} [duration] - Duration in seconds
   * @param {string} [audioName] - Name of the audio file
   * @param {string} [videoUrl] - URL of the video file (optional)
   * @returns {Promise<AudioUploadResponse>} Upload response
   */
  uploadAudioUrl: async (uid, audioUrl, language = 'en-GB', duration, audioName, videoUrl = null) => { 
    const requestBody = {
      uid, 
      audioUrl, 
      language, 
      duration,
      audio_name: audioName || `audio_${Date.now()}.mp3` // Use provided name or generate a default
    };
    
    // Add video URL if provided
    if (videoUrl) {
      requestBody.videoUrl = videoUrl;
    }
    
    const response = await fetch(`${API_BASE_URL}/api/audio/uploadAudioUrl`, { 
      method: 'POST', 
      headers: { 
        'Content-Type': 'application/json', 
      }, 
      body: JSON.stringify(requestBody), 
    }); 

    if (!response.ok) { 
      const errorData = await response.json().catch(() => ({})); 
      throw new Error(errorData.message || errorData.error || 'Failed to upload audio URL'); 
    } 

    return response.json(); 
  }, 

  /**
   * Get audio transcription status and results
   * @param {string} uid - User ID
   * @param {string} audioid - Audio ID
   * @returns {Promise<AudioStatusResponse>} Status response
   */
 

  /**
   * Get specific audio file details
   * @param {string} uid - User ID
   * @param {string} audioid - Audio ID
   * @returns {Promise<AudioFileResponse>} Audio file details
   */
  getAudioFile: async (uid, audioid) => { 
    const response = await fetch(`${API_BASE_URL}/api/audio/getAudioFile`, { 
      method: 'POST', 
      headers: { 
        'Content-Type': 'application/json', 
      }, 
      body: JSON.stringify({ 
        uid, 
        audioid 
      }), 
    }); 

    if (!response.ok) { 
      const errorData = await response.json().catch(() => ({})); 
      throw new Error(errorData.message || errorData.error || 'Failed to get audio file'); 
    } 

    return response.json(); 
  }, 

  /**
   * Get all audio files for a user
   * @param {string} uid - User ID
   * @returns {Promise<AudioListResponse>} List of audio files
   */
  getAllAudioFiles: async (uid) => { 
    const response = await fetch(`${API_BASE_URL}/api/audio/getAllAudioFiles`, { 
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
      throw new Error(errorData.message || errorData.error || 'Failed to get audio files'); 
    } 

    return response.json(); 
  }, 

  /**
   * Get audio by UID (GET endpoint)
   * @param {string} uid - User ID
   * @returns {Promise<AudioDataResponse>} Audio data
   */
  getAudio: async (uid) => { 
    const response = await fetch(`${API_BASE_URL}/api/audio/getAudio/${uid}`, { 
      method: 'GET', 
      headers: { 
        'Content-Type': 'application/json', 
      }, 
    }); 

    if (!response.ok) { 
      const errorData = await response.json().catch(() => ({})); 
      throw new Error(errorData.error || 'Failed to get audio data'); 
    } 

    return response.json(); 
  }, 

  /**
   * Remove audio file
   * @param {string} uid - User ID
   * @param {string} audioid - Audio ID
   * @returns {Promise<AudioRemoveResponse>} Remove response
   */
  removeAudio: async (uid, audioid) => { 
    const response = await fetch(`${API_BASE_URL}/api/audio/removeAudio`, { 
      method: 'POST', 
      headers: { 
        'Content-Type': 'application/json', 
      }, 
      body: JSON.stringify({ 
        uid, 
        audioid 
      }), 
    }); 

    if (!response.ok) { 
      const errorData = await response.json().catch(() => ({})); 
      throw new Error(errorData.error || 'Failed to remove audio'); 
    } 

    return response.json(); 
  }, 

  /**
   * Edit audio name
   * @param {string} uid - User ID
   * @param {string} audioid - Audio ID
   * @param {string} updatedName - New name for the audio
   * @returns {Promise<AudioEditResponse>} Edit response
   */
  editAudio: async (uid, audioid, updatedName) => { 
    const response = await fetch(`${API_BASE_URL}/api/audio/editAudio`, { 
      method: 'POST', 
      headers: { 
        'Content-Type': 'application/json', 
      }, 
      body: JSON.stringify({ 
        uid, 
        audioid, 
        updatedName 
      }), 
    }); 

    if (!response.ok) { 
      const errorData = await response.json().catch(() => ({})); 
      throw new Error(errorData.error || 'Failed to edit audio'); 
    } 

    return response.json(); 
  }, 

  /**
   * Send XML graph data
   * @param {string} uid - User ID
   * @param {string} audioid - Audio ID
   * @param {string} xmlData - XML data to send
   * @returns {Promise<XmlGraphResponse>} XML graph response
   */
  sendXmlGraph: async (uid, audioid, xmlData) => { 
    const response = await fetch(`${API_BASE_URL}/api/audio/sendXmlGraph`, { 
      method: 'POST', 
      headers: { 
        'Content-Type': 'application/json', 
      }, 
      body: JSON.stringify({ 
        uid, 
        audioid, 
        xmlData 
      }), 
    }); 

    if (!response.ok) { 
      const errorData = await response.json().catch(() => ({})); 
      throw new Error(errorData.error || 'Failed to send XML graph'); 
    } 

    return response.json(); 
  },

  /**
   * Convert audio to transcription
   * @param {string} uid - User ID
   * @param {string} audioid - Audio ID
   * @returns {Promise<Object>} Conversion response
   */
  convertAudio: async (uid, audioid) => {
    const formData = new FormData();
    formData.append('uid', uid);
    formData.append('audioid', audioid);

    const response = await fetch('https://ddtgdhehxhgarkonvpfq.supabase.co/functions/v1/convertAudio', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(errorText || 'Failed to convert audio');
    }

    return data;
  },

  /**
   * Translate text using Azure Translator API
   * @param {string} text - Text to translate
   * @param {string} targetLanguage - Target language code
   * @param {string} azureKey - Azure Translator API key
   * @param {string} region - Azure region
   * @returns {Promise<Object>} Translation response
   */
  translateText: async (text, targetLanguage, azureKey, region) => {
    const response = await fetch(
      `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${targetLanguage}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': azureKey,
          'Ocp-Apim-Subscription-Region': region,
        },
        body: JSON.stringify([{ Text: text }]),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error('Translation failed');
    }

    return data;
  }
};

export default audioService;