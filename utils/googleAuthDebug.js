/**
 * Validate a redirect URI for common issues
 * @param {string} uri - The redirect URI to validate
 * @returns {object} - Validation results
 */
export const validateRedirectUri = (uri) => {
  if (!uri) {
    return {
      valid: false,
      issues: ['Redirect URI is empty or null']
    };
  }

  const issues = [];
  let valid = true;
  
  // Check for valid URL format
  try {
    new URL(uri);
  } catch (error) {
    issues.push('Not a valid URL format');
    valid = false;
    return { valid, issues };
  }
  
  // Check for HTTPS (Google OAuth typically requires HTTPS)
  if (!uri.startsWith('https://') && !uri.startsWith('matrixai://')) {
    issues.push('URL should start with https:// for web redirects');
    valid = false;
  }
  
  // Check for trailing slashes that might cause mismatch
  if (uri.endsWith('/') && !uri.endsWith('callback/')) {
    issues.push('URL has a trailing slash that might cause mismatch');
  }
  
  // Check for common typos in the Supabase domain
  if (uri.includes('supabase.co') && !uri.includes('ddtgdhehxhgarkonvpfq.supabase.co')) {
    issues.push('Possible typo in Supabase project ID');
  }
  
  // Check for spaces or unusual characters
  if (/\s/.test(uri)) {
    issues.push('URL contains spaces');
    valid = false;
  }
  
  // Suggestions for Google Cloud Console
  let suggestedUris = [];
  
  if (uri.includes('supabase.co')) {
    // Always suggest the standard Supabase callback URL
    suggestedUris.push('https://ddtgdhehxhgarkonvpfq.supabase.co/auth/v1/callback');
    
    // If the URL has a trailing slash, suggest without it
    if (uri.endsWith('/')) {
      suggestedUris.push(uri.slice(0, -1));
    }
    
    // If the URL doesn't have a trailing slash, suggest with it
    if (!uri.endsWith('/')) {
      suggestedUris.push(uri + '/');
    }
  }
  
  // Deduplicate and filter out the original URI
  suggestedUris = suggestedUris.filter((u, i, arr) => 
    u !== uri && arr.indexOf(u) === i
  );
  
  return {
    valid,
    issues: issues.length ? issues : ['No issues detected'],
    suggestions: suggestedUris
  };
};

export const debugGoogleAuth = async () => {
  try {
    console.log('Starting Google Auth debug...');
    
    // Get the OAuth URL without opening it
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://ddtgdhehxhgarkonvpfq.supabase.co/auth/v1/callback',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        }
      }
    });
    
    if (error) {
      console.error('Failed to get OAuth URL:', error);
      return {
        success: false,
        error: error.message,
        errorDetails: error
      };
    }
    
    if (data?.url) {
      console.log('Generated OAuth URL:', data.url);
      
      // Parse and extract key parameters
      const url = new URL(data.url);
      const redirectUri = url.searchParams.get('redirect_uri');
      const clientId = url.searchParams.get('client_id');
      
      console.log('Extracted redirect_uri:', redirectUri);
      console.log('Extracted client_id:', clientId);
      
      // Validate the redirect URI
      const validation = validateRedirectUri(redirectUri);
      
      return {
        success: true,
        url: data.url,
        redirectUri,
        clientId,
        validation,
        fullParams: Object.fromEntries(url.searchParams)
      };
    } else {
      console.error('No OAuth URL returned');
      return {
        success: false,
        error: 'No OAuth URL returned from Supabase'
      };
    }
  } catch (error) {
    console.error('Exception in debugGoogleAuth:', error);
    return {
      success: false,
      error: error.message,
      errorDetails: error
    };
  }
};
