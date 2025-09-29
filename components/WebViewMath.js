import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';

const { width: screenWidth } = Dimensions.get('window');

const WebViewMath = ({ 
  mathContent, 
  width = screenWidth - 40,
  height = 'auto',
  isDarkMode = false 
}) => {
  
  console.log('🎯 WebViewMath received mathContent:', mathContent);
  
  const generateMathHTML = () => {
    const backgroundColor = isDarkMode ? '#000000' : '#FFFFFF';
    const textColor = isDarkMode ? '#FFFFFF' : '#000000';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Math Renderer</title>
        
        <!-- KaTeX CSS -->
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css" integrity="sha384-GvrOXuhMATgEsSwCs4smul74iXGOixntILdUW9XmUC6+HX0sLNAK3q71HotJqlAn" crossorigin="anonymous">
        
        <!-- KaTeX JavaScript -->
        <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js" integrity="sha384-cpW21h6RZv/phavutF+AuVYrr+dA8xD9zs6FwLpaCct6O9ctzYFfFr4dgmgccOTx" crossorigin="anonymous"></script>
        
        <!-- Auto-render extension -->
        <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js" integrity="sha384-+VBxd3r6XgURycqtZ117nYw44OOcIax56Z4dCRWbxyPt0Koah1uHoK0o4+/RRE05" crossorigin="anonymous"></script>
        
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: ${backgroundColor};
            color: ${textColor};
            line-height: 1.6;
            font-size: 16px;
          }
          
          .math-container {
            max-width: 100%;
            overflow-x: auto;
          }
          
          .katex {
            font-size: 1.1em;
          }
          
          .katex-display {
            margin: 1em 0;
            text-align: center;
          }
          
          h1, h2, h3, h4, h5, h6 {
            color: ${textColor};
            margin-top: 1.5em;
            margin-bottom: 0.5em;
          }
          
          p {
            margin: 1em 0;
          }
          
          ol, ul {
            margin: 1em 0;
            padding-left: 2em;
          }
          
          li {
            margin: 0.5em 0;
          }
          
          strong {
            font-weight: 600;
          }
          
          /* Dark mode specific styles */
          ${isDarkMode ? `
            .katex .base {
              color: ${textColor};
            }
            
            .katex .mord, .katex .mop, .katex .mrel, .katex .mbin, .katex .mpunct {
              color: ${textColor};
            }
          ` : ''}
          
          /* Responsive design */
          @media (max-width: 768px) {
            body {
              padding: 15px;
              font-size: 14px;
            }
            
            .katex {
              font-size: 1em;
            }
          }
        </style>
      </head>
      <body>
        <div class="math-container">
          ${mathContent}
        </div>
        
        <script>
          document.addEventListener("DOMContentLoaded", function() {
            try {
              renderMathInElement(document.body, {
                delimiters: [
                  {left: '\\\\[', right: '\\\\]', display: true},
                  {left: '\\\\(', right: '\\\\)', display: false},
                  {left: '$$', right: '$$', display: true},
                  {left: '$', right: '$', display: false}
                ],
                throwOnError: false,
                errorColor: '#cc0000',
                strict: false,
                trust: false,
                macros: {
                  "\\\\f": "#1f(#2)",
                  "\\\\mathcal": "\\\\mathrm{#1}",
                  "\\\\R": "\\\\mathbb{R}",
                  "\\\\N": "\\\\mathbb{N}",
                  "\\\\Z": "\\\\mathbb{Z}",
                  "\\\\Q": "\\\\mathbb{Q}",
                  "\\\\C": "\\\\mathbb{C}"
                }
              });
              
              // Adjust height after rendering
              setTimeout(() => {
                const height = Math.max(document.body.scrollHeight, document.body.offsetHeight);
                window.ReactNativeWebView?.postMessage(JSON.stringify({
                  type: 'height',
                  height: height
                }));
              }, 100);
              
            } catch (error) {
              console.error('KaTeX rendering error:', error);
              window.ReactNativeWebView?.postMessage(JSON.stringify({
                type: 'error',
                message: 'Failed to render mathematical expressions: ' + error.message
              }));
            }
          });
          
          // Handle errors
          window.addEventListener('error', function(e) {
            console.error('JavaScript error:', e.error);
            window.ReactNativeWebView?.postMessage(JSON.stringify({
              type: 'error',
              message: 'JavaScript error: ' + e.error.message
            }));
          });
        </script>
      </body>
      </html>
    `;
  };

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'height' && data.height) {
        // You can handle dynamic height adjustment here if needed
        console.log('Math content height:', data.height);
      } else if (data.type === 'error') {
        console.error('Math rendering error:', data.message);
      }
    } catch (error) {
      console.error('Error handling math message:', error);
    }
  };

  return (
    <View style={[styles.container, { width }]}>
      <WebView
        source={{ html: generateMathHTML() }}
        style={[styles.webview, height !== 'auto' && { height }]}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        scrollEnabled={true}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.warn('WebView error: ', nativeEvent);
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.warn('WebView HTTP error: ', nativeEvent);
        }}
        onMessage={handleMessage}
        originWhitelist={['*']}
        mixedContentMode="compatibility"
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    minHeight: 100,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
    minHeight: 100,
  },
});

export default WebViewMath;