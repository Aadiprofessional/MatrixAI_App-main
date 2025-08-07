import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, PermissionsAndroid, ActivityIndicator, Alert } from 'react-native';
import OpenAI from 'openai';
import { WebView } from 'react-native-webview';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import Share from 'react-native-share';
import ViewShot from 'react-native-view-shot';
import RNFS from 'react-native-fs';
import { useTheme } from '../context/ThemeContext';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { DASHSCOPE_API_KEY } from '@env';

const ForceDirectedGraph = forwardRef(({ transcription, uid, audioid, xmlData }, ref) => {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors() || {
    background: '#FFFFFF',
    text: '#333333',
    primary: '#007AFF',
    border: '#E0E0E0'
  };
  
  const [graphData, setGraphData] = useState(null);
  const viewShotRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [tempWebView, setTempWebView] = useState(null);
  const webViewRef = useRef(null);
  // Removed OpenAI client - using direct API calls instead

  const parseXMLData = (xmlString) => {
    const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: true });
    try {
      const jsonData = parser.parse(xmlString);
      const formattedData = formatGraphData(jsonData);
      if (formattedData) setGraphData(formattedData);
    } catch (err) {
      console.error('Error parsing XML:', err);
    }
  };

  const formatGraphData = (root) => {
    const formatNode = (node, name = 'Root') => {
      const formattedNode = { name, children: [] };

      if (node['#text'] || node['?xml']) return null;

      if (node.meeting && node.meeting.topic) {
        const topics = Array.isArray(node.meeting.topic) ? node.meeting.topic : [node.meeting.topic];
        topics.forEach((topic, index) => {
          const topicNode = { name: topic['@_name'] || `Topic ${index + 1}`, children: [] };
          if (topic.description) topicNode.children.push({ name: topic.description });
          if (topic.subtopic) {
            const subtopics = Array.isArray(topic.subtopic) ? topic.subtopic : [topic.subtopic];
            subtopics.forEach((subtopic) => {
              const subtopicNode = { name: subtopic['@_name'], children: [] };
              if (subtopic.description) subtopicNode.children.push({ name: subtopic.description });
              if (subtopic.action_items?.item) {
                const items = Array.isArray(subtopic.action_items.item) ? subtopic.action_items.item : [subtopic.action_items.item];
                items.forEach((item) => subtopicNode.children.push({ name: item }));
              }
              topicNode.children.push(subtopicNode);
            });
          }
          formattedNode.children.push(topicNode);
        });
        return formattedNode;
      }

      Object.entries(node).forEach(([key, value]) => {
        if (typeof value === 'object') {
          const child = formatNode(value, key);
          if (child) formattedNode.children.push(child);
        } else {
          formattedNode.children.push({ name: key, children: [{ name: String(value) }] });
        }
      });
      return formattedNode;
    };

    return root ? [formatNode(root)] : null;
  };

  const fetchGraphData = async (transcription) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', true);
      xhr.setRequestHeader('Authorization', `Bearer ${DASHSCOPE_API_KEY}`);
      xhr.setRequestHeader('Content-Type', 'application/json');

      let fullContent = '';

      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            try {
              const response = JSON.parse(xhr.responseText);
              const content = response.choices[0]?.message?.content;
              if (content) {
                console.log('XML Response from API:', content);
                sendXmlGraphData(content);
                parseXMLData(content);
              } else {
                console.error('No valid response from API');
              }
            } catch (parseError) {
              console.error('Error parsing response:', parseError);
            }
          } else {
            console.error('API request failed:', xhr.status, xhr.statusText);
          }
        }
      };

      const requestBody = JSON.stringify({
        model: "qwen-vl-max",
        messages: [
          {
            role: "user",
            content: `Generate a hierarchical XML structure from this meeting transcript in the same language as the transcript: "${transcription}".
            Create a tree structure with main topics and subtopics.
            Use this format:
            <meeting>
              <topic name="Main Topic 1">
                <subtopic name="Subtopic 1">
                  <description>Detailed description of subtopic</description>
                  <action_items>
                    <item>Action item 1</item>
                    <item>Action item 2</item>
                  </action_items>
                </subtopic>
                <subtopic name="Subtopic 2">
                  <description>Detailed description of subtopic</description>
                </subtopic>
              </topic>
              <topic name="Main Topic 2">
                <description>Overall description of topic</description>
              </topic>
            </meeting>
            Make sure the XML is in the same language as the transcript.`
          }
        ],
        temperature: 0.7,
        max_tokens: 2048
      });

      xhr.send(requestBody);
    } catch (error) {
      console.error('Error fetching graph data:', error.message);
    }
  };

  // Send XML graph data to the API
  const sendXmlGraphData = async (xmlData) => {
    if (!xmlData) {
      console.error('No XML data available to send.');
      return;
    }

    try {
      const response = await axios.post('https://main-matrixai-server-lujmidrakh.cn-hangzhou.fcapp.run/api/audio/sendXmlGraph', {
        uid,
        audioid,
        xmlData,
      });
      console.log('XML Graph Data Sent:', response.data);
      console.log('Sending XML to Database:', xmlData);

    } catch (error) {
      console.error('Error sending XML Graph Data:', error.message);
    }
  };

  useEffect(() => {
    console.log('ViewShot Ref:', viewShotRef.current); // Should not be null
  }, []);
  

  useEffect(() => {
    if (xmlData) parseXMLData(xmlData);
    else if (transcription) fetchGraphData(transcription);
  }, [transcription, xmlData]);

  useImperativeHandle(ref, () => ({
    handleDownload
  }));

  if (!graphData) {
    return (
      <View style={[styles.loadingContainer, {backgroundColor: colors?.background || '#ffffff'}]}>
        <Text style={{color: colors?.text || '#000000'}}>Loading graph...</Text>
      </View>
    );
  }

  
  const chartHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <script src="https://cdn.jsdelivr.net/npm/echarts/dist/echarts.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <style>
      html, body {
        height: 100%;
        width: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
        background-color: ${colors?.background || '#ffffff'};
        color: ${colors?.text || '#000000'};
      }
      #chart {
        width: 100%;
        height: 200%;
      }
    </style>
  </head>
  <body>
    <div id="chart"></div>
    <script>
      // Function to detect optimal chart size based on complexity
      function detectOptimalChartSize(data) {
        const countNodes = (nodes) => {
          let count = 0;
          if (!nodes) return count;
          count += nodes.length;
          nodes.forEach(node => {
            if (node.children && node.children.length) {
              count += countNodes(node.children);
            }
          });
          return count;
        };
        
        const nodeCount = countNodes(data);
        const depth = (nodes, level = 0) => {
          if (!nodes || !nodes.length) return level;
          let maxDepth = level;
          nodes.forEach(node => {
            if (node.children && node.children.length) {
              const childDepth = depth(node.children, level + 1);
              maxDepth = Math.max(maxDepth, childDepth);
            }
          });
          return maxDepth;
        };
        
        const maxDepth = depth(data);
        
        return {
          repulsion: Math.max(1000, 800 + nodeCount * 10),
          edgeLength: Math.max(300, 200 + (maxDepth * 20)),
          layerSpacing: Math.max(120, 80 + maxDepth * 20),
          nodeSpacing: Math.max(60, 40 + nodeCount)
        };
      }

      const chartDom = document.getElementById('chart');
      const myChart = echarts.init(chartDom);
      const chartColors = ['#5470C6', '#91CC75', '#EE6666', '#FAC858', '#73C0DE', '#3BA272', '#FC8452', '#9A60B4', '#EA7CCC'];
      const themeBackground = '${colors?.background || "#ffffff"}';
      const themeText = '${colors?.text || "#000000"}';

      function assignColors(node, index = 0) {
        node.lineStyle = { color: chartColors[index % chartColors.length] };
        if (node.children) {
          node.children.forEach((child, idx) => assignColors(child, idx));
        }
        return node;
      }

      const coloredGraphData = ${JSON.stringify(graphData)}.map((node, idx) => assignColors(node, idx));
      const { repulsion, edgeLength, layerSpacing, nodeSpacing } = detectOptimalChartSize(coloredGraphData);

      // Function to wrap text into multiple lines with dynamic max length
      function wrapText(text, nodeType) {
        let maxLineLength = 16; // Reduced for topic and subtopic nodes
        if (nodeType === 'description') {
          maxLineLength = 70; // Reduced for description nodes
        }

        const words = text.split(' ');
        const lines = [];
        let currentLine = '';

        words.forEach(word => {
          if ((currentLine + word).length > maxLineLength) {
            lines.push(currentLine.trim());
            currentLine = word + ' ';
          } else {
            currentLine += word + ' ';
          }
        });

        if (currentLine.trim()) {
          lines.push(currentLine.trim());
        }

        return lines.join('\\n'); // Join lines with newline character
      }

      // Function to calculate label height based on number of lines
      function calculateLabelHeight(text, fontSize = 18, lineHeight = 1.5) {
        const lines = text.split('\\n').length;
        return lines * fontSize * lineHeight;
      }

      const option = {
        backgroundColor: themeBackground,
        tooltip: { trigger: 'item', triggerOn: 'mousemove' },
        series: [{
          type: 'tree',
          data: coloredGraphData,
          top: '2%',
          left: '8%',
          bottom: '2%',
          right: '25%', // Increased right margin to prevent text cutoff
          roam: true,
          symbolSize: 8,
          label: {
            position: 'left',
            verticalAlign: 'middle',
            align: 'right',
            fontSize: 18,
            color: themeText,
            formatter: (params) => {
              // Wrap text into multiple lines based on node type
              const nodeType = params.data.nodeType || 'topic'; // Default to 'topic'
              return wrapText(params.name, nodeType);
            },
            rich: {
              a: {
                lineHeight: 24, // Adjust line height to match font size
              }
            }
          },
          leaves: {
            label: {
              position: 'right',
              verticalAlign: 'middle',
              align: 'left',
              color: themeText,
              distance: 15, // Added distance to prevent text cutoff
              formatter: (params) => {
                // Wrap text into multiple lines based on node type
                const nodeType = params.data.nodeType || 'description'; // Default to 'description'
                return wrapText(params.name, nodeType);
              },
              rich: {
                a: {
                  lineHeight: 24, // Adjust line height to match font size
                }
              }
            },
          },
          emphasis: { focus: 'descendant' },
          expandAndCollapse: true,
          initialTreeDepth: 3,
          force: {
            repulsion: repulsion, // Dynamic repulsion based on graph complexity
            gravity: 0.1,
            edgeLength: edgeLength, // Dynamic edge length
            layoutAnimation: true,
          },
          layerSpacing: layerSpacing,  // Dynamic vertical spacing
          nodeSpacing: nodeSpacing,   // Dynamic horizontal spacing
          zoom: 0.8, // Add slight zoom out to fit more content
          center: ['40%', '50%'] // Center the tree
        }],
      };
      myChart.setOption(option);
    </script>
  </body>
  </html>
`;

const downloadPDF = async () => {
  try {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        throw new Error('Storage permission denied');
      }
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <script src="https://cdn.jsdelivr.net/npm/echarts/dist/echarts.min.js"></script>
          <style>
            body { 
              margin: 0; 
              padding: 0; 
              background: ${colors?.background || '#ffffff'};
              width: 100%;
              height: 100%;
              overflow: hidden;
            }
            #chart { 
              width: 100%;
              height: 100%;
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
            }
          </style>
        </head>
        <body>
          <div id="chart"></div>
          <script>
            // Function to detect optimal chart size based on graph complexity
            function detectOptimalChartSize(data) {
              const countNodes = (nodes) => {
                let count = 0;
                if (!nodes) return count;
                count += nodes.length;
                nodes.forEach(node => {
                  if (node.children && node.children.length) {
                    count += countNodes(node.children);
                  }
                });
                return count;
              };
              
              const nodeCount = countNodes(data);
              const depth = (nodes, level = 0) => {
                if (!nodes || !nodes.length) return level;
                let maxDepth = level;
                nodes.forEach(node => {
                  if (node.children && node.children.length) {
                    const childDepth = depth(node.children, level + 1);
                    maxDepth = Math.max(maxDepth, childDepth);
                  }
                });
                return maxDepth;
              };
              
              const maxDepth = depth(data);
              
              // Calculate dimensions based on complexity
              // Use larger dimensions for more complex graphs
              const width = Math.max(3000, 1200 + nodeCount * 70);
              const height = Math.max(2000, 1000 + maxDepth * 200);
              
              return { width, height };
            }
            
            const graphData = ${JSON.stringify(graphData)};
            const { width, height } = detectOptimalChartSize(graphData);
            
            // Set chart container size
            document.getElementById('chart').style.width = width + 'px';
            document.getElementById('chart').style.height = height + 'px';
            document.body.style.backgroundColor = "${colors?.background || '#ffffff'}";
            
            const chartDom = document.getElementById('chart');
            const myChart = echarts.init(chartDom, null, {
              renderer: 'svg',
              width: width,
              height: height
            });
            
            function wrapText(text, nodeType) {
              let maxLineLength = 16; // Reduced to avoid text cutoff
              if (nodeType === 'description') {
                maxLineLength = 70; // Reduced for description nodes
              }

              const words = text.split(' ');
              const lines = [];
              let currentLine = '';

              words.forEach(word => {
                if ((currentLine + word).length > maxLineLength) {
                  lines.push(currentLine.trim());
                  currentLine = word + ' ';
                } else {
                  currentLine += word + ' ';
                }
              });

              if (currentLine.trim()) {
                lines.push(currentLine.trim());
              }

              return lines.join('\\n');
            }
            
            const option = {
              backgroundColor: "${colors?.background || '#ffffff'}",
              tooltip: { 
                trigger: 'item', 
                triggerOn: 'mousemove' 
              },
              series: [{
                type: 'tree',
                data: graphData,
                top: '5%',
                left: '5%',
                bottom: '5%',
                right: '25%', // Increased right margin to prevent text cutoff
                symbolSize: 8,
                initialTreeDepth: -1, // Expand all nodes
                orient: 'LR',
                label: {
                  position: 'left',
                  verticalAlign: 'middle',
                  align: 'right',
                  fontSize: 18,
                  distance: 5,
                  formatter: (params) => {
                    const nodeType = params.data.nodeType || 'topic';
                    return wrapText(params.name, nodeType);
                  },
                  rich: {
                    a: {
                      lineHeight: 24,
                    }
                  }
                },
                leaves: {
                  label: {
                    position: 'right',
                    verticalAlign: 'middle',
                    align: 'left',
                    distance: 15, // Added distance to prevent text cutoff
                    formatter: (params) => {
                      const nodeType = params.data.nodeType || 'description';
                      return wrapText(params.name, nodeType);
                    }
                  }
                },
                expandAndCollapse: false,
                animationDuration: 0,
                force: {
                  repulsion: 1200,
                  gravity: 0.1,
                  edgeLength: 300,
                  layoutAnimation: false
                },
                nodeSpacing: 60,
                layerSpacing: 200,
                roam: false,
                lineStyle: {
                  width: 2,
                  curveness: 0.5
                }
              }]
            };
            
            myChart.setOption(option);
            
            // Wait for chart to render then capture
            setTimeout(() => {
              const base64 = myChart.getDataURL({ 
                type: 'png', 
                pixelRatio: 2,
                backgroundColor: "${colors?.background || '#ffffff'}",
                excludeComponents: ['toolbox']
              });
              window.ReactNativeWebView.postMessage(base64);
            }, 5000);
          </script>
        </body>
      </html>
    `;

    return new Promise((resolve, reject) => {
      let hasProcessedImage = false;

      const processBase64Image = async (base64Image) => {
        if (hasProcessedImage) return;
        hasProcessedImage = true;

        try {
          const pdfOptions = {
            html: `
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <style>
                    html, body {
                      margin: 0;
                      padding: 0;
                      background-color: ${colors?.background || '#ffffff'};
                      width: 100%;
                      height: 100%;
                      overflow: hidden;
                    }
                    .img-container {
                      background-color: ${colors?.background || '#ffffff'};
                      width: 100%;
                      height: 100%;
                      position: relative;
                      overflow: hidden;
                    }
                    img {
                      max-width: 100%;
                      width: 100%;
                      display: block;
                      background-color: ${colors?.background || '#ffffff'};
                    }
                  </style>
                </head>
                <body>
                  <div class="img-container">
                    <img src="${base64Image}" />
                  </div>
                </body>
              </html>
            `,
            fileName: `mindmap_${Date.now()}`,
            directory: 'Documents',
            width: 2480,  // A2 width (landscape)
            height: 1754, // A2 height (landscape)
            backgroundColor: colors?.background || '#ffffff',
            padding: 0,
            options: {
              landscape: true,
              printBackground: true,
              preferCSSPageSize: true,
              margin: {
                top: '0mm',
                right: '0mm',
                bottom: '0mm',
                left: '0mm'
              },
              pageSize: { width: 2480, height: 1754 }  // Custom size (close to A2)
            }
          };

          const file = await RNHTMLtoPDF.convert(pdfOptions);
          
          if (file.filePath) {
            if (Platform.OS === 'android') {
              const downloadPath = `${RNFS.DownloadDirectoryPath}/mindmap_${Date.now()}.pdf`;
              await RNFS.moveFile(file.filePath, downloadPath);
              resolve(downloadPath);
            } else {
              resolve(file.filePath);
            }
          } else {
            reject(new Error('PDF generation failed'));
          }
        } catch (error) {
          reject(error);
        }
      };

      const TempWebView = (
        <WebView
          ref={webViewRef}
          source={{ html: htmlContent }}
          javaScriptEnabled={true}
          onMessage={(event) => {
            processBase64Image(event.nativeEvent.data);
          }}
          style={{ width: 1, height: 1, opacity: 0 }}
        />
      );

      setTempWebView(TempWebView);

      setTimeout(() => {
        setTempWebView(null);
        if (!hasProcessedImage) {
          reject(new Error('Timeout generating PDF'));
        }
      }, 120000);
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};

const handleDownload = async () => {
  try {
    setLoading(true);
    if (!graphData) {
      Alert.alert(t('noData'), t('pleaseWaitForMindMap'));
      return;
    }

    const filePath = await downloadPDF();
    
    // Share the PDF
    await Share.open({
      url: `file://${filePath}`,
      type: 'application/pdf',
      title: 'Mind Map PDF',
      showAppsToView: true,
      excludedActivityTypes: []
    });

    Alert.alert(t('success'), t('pdfDownloadedSuccessfully'));
  } catch (error) {
    console.error('Failed to download PDF:', error);
    Alert.alert(t('error'), t('failedToGeneratePDF'));
  } finally {
    setLoading(false);
  }
};

  return (
    <View style={[styles.container, {backgroundColor: colors?.background || '#ffffff'}]}>
      <ViewShot 
        ref={viewShotRef} 
        options={{ format: 'png', quality: 1.0 }}
        style={{ flex: 1 }}
      >
        <WebView
          originWhitelist={['*']}
          source={{ html: chartHtml }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          style={{ height: 650, width: '100%', backgroundColor: colors?.background || '#ffffff' }}
          onLoadEnd={() => {
            // Wait for the chart to be fully rendered
            setTimeout(() => {
              console.log('Chart rendered and ready for capture');
            }, 1000);
          }}
        />
      </ViewShot>

      {tempWebView}  {/* Render temporary WebView when needed */}

 
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  iconButton: {
    position: 'absolute',
    bottom: 16, // distance from bottom
    left: 20,   // distance from left
    borderRadius: 30,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000, // ensure it's on top
  },
  iconButtonDisabled: {
    // styles for disabled state
  },
  loader: {
    width: 28,
    height: 28,
  },
  
});

export const getSvgData = () => {
  return new Promise((resolve) => {
    const script = `
      (function() {
        const chart = echarts.getInstanceByDom(document.getElementById('chart'));
        if (!chart) return '';
        const svg = chart.renderToSVGString();
        return svg;
      })();
    `;
    
    // Execute script in WebView context
    const webViewRef = document.getElementsByTagName('webview')[0];
    if (webViewRef) {
      webViewRef.executeJavaScript(script, true)
        .then(svg => resolve(svg))
        .catch(() => resolve(''));
    } else {
      resolve('');
    }
  });
};

export default ForceDirectedGraph;