import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';

const { width: screenWidth } = Dimensions.get('window');

const WebViewChart = ({ 
  chartData, 
  width = screenWidth - 40,
  height = 300,
  isDarkMode = false 
}) => {
  if (!chartData || !chartData.type || !chartData.data) return null;

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
    <View style={[styles.container, { height, width }]}>
      <WebView
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
        onMessage={(event) => {
          console.log('WebView message:', event.nativeEvent.data);
        }}
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
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default WebViewChart;