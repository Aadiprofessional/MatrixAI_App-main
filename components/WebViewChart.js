import React, { useState, useRef } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, Text, Modal, Alert, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';

const { width: screenWidth } = Dimensions.get('window');

const WebViewChart = ({ 
  chartData, 
  width = screenWidth,
  height = 300,
  isDarkMode = false 
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const webViewRef = useRef(null);
  
  if (!chartData || !chartData.type || !chartData.data) return null;

  const handleDownload = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        try {
          if (typeof downloadChart === 'function') {
            downloadChart();
          } else {
            console.log('downloadChart function not available');
          }
        } catch (error) {
          console.error('Download injection error:', error);
        }
        true;
      `);
    }
  };

  const handleFullscreen = () => {
    setIsFullscreen(true);
  };

  const handleMessage = async (event) => {
    try {
      const message = event.nativeEvent.data;
      
      // Try to parse as JSON for structured messages
      try {
        const parsedMessage = JSON.parse(message);
        if (parsedMessage.type === 'download' && parsedMessage.data) {
          // Save image to iOS Photos
          try {
            if (Platform.OS === 'ios') {
              await CameraRoll.save(parsedMessage.data, { type: 'photo' });
              Alert.alert('Success', 'Chart saved to Photos successfully!');
            } else {
              Alert.alert('Download', 'Chart image data received. Android implementation needed.');
            }
          } catch (saveError) {
            console.error('Save error:', saveError);
            Alert.alert('Error', 'Failed to save chart to Photos. Please check permissions.');
          }
        } else if (parsedMessage.type === 'error') {
          Alert.alert('Error', parsedMessage.message);
        }
      } catch (parseError) {
        // Handle simple string messages
        console.log('WebView message:', message);
      }
    } catch (error) {
      console.error('Message handling error:', error);
    }
  };

  const generateChartHTML = () => {
    const backgroundColor = isDarkMode ? '#1C1C1E' : '#FFFFFF';
    const textColor = isDarkMode ? '#FFFFFF' : '#000000';
    const gridColor = isDarkMode ? '#38383A' : '#E5E5E7';
    
    // Extract chart type and convert to Chart.js format
    const chartType = chartData.type.toLowerCase();
    const chartTitle = chartData.title || '';
    
    // Convert chartData to Chart.js format
    const chartConfig = {
      type: chartType === 'doughnut' ? 'doughnut' : chartType,
      data: chartData.data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: !!chartTitle,
            text: chartTitle,
            color: textColor,
            font: {
              size: 16,
              weight: 'bold'
            }
          },
          legend: {
            labels: {
              color: textColor
            }
          }
        },
        ...(chartType !== 'pie' && chartType !== 'doughnut' ? {
          scales: {
            x: {
              grid: {
                color: gridColor
              },
              ticks: {
                color: textColor
              }
            },
            y: {
              grid: {
                color: gridColor
              },
              ticks: {
                color: textColor
              }
            }
          }
        } : {})
      }
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <style>
          body {
            margin: 0;
            padding: 10px;
            background-color: ${backgroundColor};
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          #chartContainer {
            position: relative;
            height: ${height - 20}px;
            width: 100%;
          }
        </style>
      </head>
      <body>
        <div id="chartContainer">
          <canvas id="myChart"></canvas>
        </div>
        <script>
          window.addEventListener('load', function() {
            try {
              console.log('Chart.js loaded:', typeof Chart !== 'undefined');
              const ctx = document.getElementById('myChart').getContext('2d');
              const chartConfig = ${JSON.stringify(chartConfig)};
              
              console.log('Chart config:', chartConfig);
              
              const chart = new Chart(ctx, chartConfig);
              console.log('Chart created successfully:', chart);
              
              // Add download functionality
              window.downloadChart = function() {
                try {
                  const canvas = document.getElementById('myChart');
                  const dataURL = canvas.toDataURL('image/png');
                  if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'download',
                      data: dataURL
                    }));
                  }
                } catch (error) {
                  console.error('Download error:', error);
                  if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'error',
                      message: 'Download failed: ' + error.message
                    }));
                  }
                }
              };
              
              // Send success message to React Native
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage('Chart loaded successfully');
              }
            } catch (error) {
              console.error('Chart rendering error:', error);
              document.body.innerHTML = '<div style="color: ${textColor}; text-align: center; padding: 20px; font-size: 14px;">Chart could not be rendered: ' + error.message + '</div>';
              
              // Send error message to React Native
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage('Chart error: ' + error.message);
              }
            }
          });
        </script>
      </body>
      </html>
    `;
  };

  return (
    <>
      <View style={styles.chartWrapper}>
        {/* Chart Container */}
        <View style={[styles.chartContainer, { height, width }]}>
          <WebView
            ref={webViewRef}
            source={{ html: generateChartHTML() }}
            style={styles.webview}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            scalesPageToFit={true}
            scrollEnabled={false}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.warn('WebView error: ', nativeEvent);
            }}
            onHttpError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.warn('WebView HTTP error: ', nativeEvent);
            }}
            onMessage={handleMessage}
          />
        </View>
        
        {/* Action Buttons - Below Chart */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.fullscreenButton, isDarkMode ? styles.darkButton : styles.lightButton]}
            onPress={handleFullscreen}
          >
            <Icon name="fullscreen" size={20} color={isDarkMode ? '#FFFFFF' : '#000000'} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.downloadButton, isDarkMode ? styles.darkButton : styles.lightButton]}
            onPress={handleDownload}
          >
            <Icon name="download" size={18} color={isDarkMode ? '#FFFFFF' : '#000000'} />
            <Text style={[styles.buttonText, { color: isDarkMode ? '#FFFFFF' : '#000000' }]}>
              Download
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Fullscreen Modal */}
      <Modal
        visible={isFullscreen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setIsFullscreen(false)}
      >
        <View style={[styles.fullscreenContainer, { backgroundColor: isDarkMode ? '#000000' : '#FFFFFF' }]}>
          <View style={styles.fullscreenHeader}>
            <TouchableOpacity 
              style={[styles.closeButton, isDarkMode ? styles.darkButton : styles.lightButton]}
              onPress={() => setIsFullscreen(false)}
            >
              <Icon name="close" size={24} color={isDarkMode ? '#FFFFFF' : '#000000'} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.fullscreenChartContainer}>
            <WebView
              ref={webViewRef}
              source={{ html: generateChartHTML() }}
              style={styles.fullscreenWebview}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              scalesPageToFit={true}
              scrollEnabled={false}
              onMessage={handleMessage}
            />
            
            <View style={styles.fullscreenButtonContainer}>
              <TouchableOpacity 
                style={[styles.downloadButton, isDarkMode ? styles.darkButton : styles.lightButton]}
                onPress={handleDownload}
              >
                <Icon name="download" size={18} color={isDarkMode ? '#FFFFFF' : '#000000'} />
                <Text style={[styles.buttonText, { color: isDarkMode ? '#FFFFFF' : '#000000' }]}>
                  Download
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  chartWrapper: {
    backgroundColor: 'transparent',
  },
  chartContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
    gap: 10,
  },
  fullscreenButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E5E7',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#E5E5E7',
  },
  lightButton: {
    backgroundColor: '#F2F2F7',
    borderColor: '#E5E5E7',
  },
  darkButton: {
    backgroundColor: '#2C2C2E',
    borderColor: '#38383A',
  },
  buttonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
  },
  fullscreenContainer: {
    flex: 1,
  },
  fullscreenHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  fullscreenChartContainer: {
    flex: 1,
    margin: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  fullscreenWebview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  fullscreenButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
  },
});

export default WebViewChart;