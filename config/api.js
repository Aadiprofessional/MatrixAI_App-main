// API configuration

// Base URL for API requests
export const API_BASE_URL = 'https://api.matrixai.com';

/**
 * Get default headers for API requests
 * @param {boolean} includeAuth - Whether to include authorization headers
 * @param {object} session - User session object containing token
 * @returns {object} Headers object
 */
export const getDefaultHeaders = (includeAuth = false, session = null) => {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  if (includeAuth && session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  return headers;
};