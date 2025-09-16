import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  TouchableOpacity,
  Linking,
  FlatList,
} from 'react-native';
import Pdf from 'react-native-pdf';
import RNFS from 'react-native-fs';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as XLSX from 'xlsx';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

const { width: screenWidth } = Dimensions.get('window');

// PDF Viewer Component
export const PDFViewer = ({ url, colors, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  return (
    <View style={[styles.viewerContainer, { backgroundColor: colors.background }]}>
      {loading && (
        <View style={[styles.loadingContainer, { backgroundColor: colors.background + 'E6' }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading PDF...</Text>
        </View>
      )}
      
      {error && (
        <View style={styles.errorContainer}>
          <Icon name="error" size={48} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>Failed to load PDF</Text>
          <Text style={[styles.errorSubtext, { color: colors.textSecondary }]}>{error}</Text>
          <TouchableOpacity 
            style={[styles.downloadButton, { backgroundColor: colors.primary, marginTop: 16 }]}
            onPress={() => setError(null)}
          >
            <Icon name="refresh" size={20} color="white" />
            <Text style={styles.downloadButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}
      
      <Pdf
        source={{ uri: url, cache: true }}
        style={styles.pdf}
        onLoadComplete={(numberOfPages) => {
          setTotalPages(numberOfPages);
          setLoading(false);
        }}
        onPageChanged={(page) => {
          setCurrentPage(page);
        }}
        onError={(error) => {
          setError(error.message || 'Failed to load PDF');
          setLoading(false);
        }}
        onLoadProgress={(percent) => {
          // Optional: You can show progress here
        }}
        enablePaging={true}
        horizontal={false}
        spacing={10}
        password=""
        scale={1.0}
        minScale={0.5}
        maxScale={3.0}
        renderActivityIndicator={() => null} // We handle loading ourselves
      />
    </View>
  );
};

// DOCX Viewer Component
export const DOCXViewer = ({ url, colors, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [documentContent, setDocumentContent] = useState(null);
  const [fileName, setFileName] = useState('Document');

  useEffect(() => {
    if (url) {
      loadDocumentPreview();
    }
  }, [url]);

  const loadDocumentPreview = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Extract filename from URL
      const urlParts = url.split('/');
      const fileNameFromUrl = urlParts[urlParts.length - 1] || 'Document';
      setFileName(fileNameFromUrl.replace(/\.[^/.]+$/, "")); // Remove extension
      
      // Add timeout for network requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,*/*'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Document not found (404)');
        } else if (response.status === 403) {
          throw new Error('Access denied to document (403)');
        } else if (response.status >= 500) {
          throw new Error('Server error - please try again later');
        } else {
          throw new Error(`Failed to fetch document (${response.status})`);
        }
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      // Validate file size (max 10MB for preview)
      if (arrayBuffer.byteLength === 0) {
        throw new Error('Document file is empty');
      }
      
      if (arrayBuffer.byteLength > 10 * 1024 * 1024) {
        throw new Error('Document is too large to preview (max 10MB)');
      }
      
      await parseDocxFile(arrayBuffer);
    } catch (err) {
      console.error('Error loading document preview:', err);
      
      if (err.name === 'AbortError') {
        setError('Request timed out - please check your connection and try again');
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load document preview';
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const parseDocxFile = async (arrayBuffer) => {
    try {
      // Check for DOCX file signature (ZIP-based)
      const uint8Array = new Uint8Array(arrayBuffer);
      const isZipBased = uint8Array[0] === 0x50 && uint8Array[1] === 0x4B;
      
      if (!isZipBased) {
        throw new Error('File does not appear to be a valid DOCX file');
      }
      
      // Use PizZip to read the DOCX file
      const zip = new PizZip(arrayBuffer);
      
      // Extract document.xml which contains the main content
      let documentXml;
      try {
        documentXml = zip.file("word/document.xml").asText();
      } catch (e) {
        throw new Error('Invalid DOCX structure - missing document.xml');
      }
      
      // Simple text extraction from XML
      const textContent = extractTextFromDocumentXml(documentXml);
      
      if (!textContent || textContent.trim().length === 0) {
        throw new Error('Document appears to be empty or contains no readable text');
      }
      
      setDocumentContent(textContent);
    } catch (err) {
      console.error('Document parsing error:', err);
      
      // Provide user-friendly error messages
      if (err.message.includes('File does not appear to be a valid DOCX')) {
        throw err;
      } else if (err.message.includes('Invalid DOCX structure')) {
        throw err;
      } else if (err.message.includes('no readable text')) {
        throw err;
      } else if (err.message.includes('network') || err.message.includes('fetch')) {
        throw new Error('Network error: Please check your internet connection and try again');
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        throw new Error(`Failed to parse document: ${errorMessage}`);
      }
    }
  };

  const extractTextFromDocumentXml = (xml) => {
    // Simple regex-based text extraction from DOCX XML
    // This extracts text from <w:t> tags which contain the actual text content
    const textMatches = xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
    if (!textMatches) return '';
    
    const textContent = textMatches
      .map(match => {
        const textMatch = match.match(/<w:t[^>]*>([^<]*)<\/w:t>/);
        return textMatch ? textMatch[1] : '';
      })
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return textContent;
  };

  const handleDownload = async () => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Cannot open this document type');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to open document');
    }
  };

  return (
    <View style={[styles.viewerContainer, { backgroundColor: colors.background }]}>
      {loading && (
        <View style={[styles.loadingContainer, { backgroundColor: colors.background + 'E6' }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading document...</Text>
        </View>
      )}
      
      {error && (
        <View style={styles.errorContainer}>
          <Icon name="error" size={48} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>Failed to load document</Text>
          <Text style={[styles.errorSubtext, { color: colors.textSecondary }]}>{error}</Text>
          <TouchableOpacity 
            style={[styles.downloadButton, { backgroundColor: colors.primary, marginTop: 16 }]}
            onPress={handleDownload}
          >
            <Icon name="open-in-new" size={20} color="white" />
            <Text style={styles.downloadButtonText}>Open Externally</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {documentContent && !loading && !error && (
        <ScrollView style={styles.documentContentContainer} showsVerticalScrollIndicator={true}>
          <View style={styles.documentContent}>
            <Text style={[styles.documentText, { color: colors.text }]}>
              {documentContent}
            </Text>
          </View>

        </ScrollView>
      )}
    </View>
  );
};

// XLSX Viewer Component
export const XLSXViewer = ({ url, colors, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sheetsData, setSheetsData] = useState([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [fileName, setFileName] = useState('Spreadsheet');

  useEffect(() => {
    if (url) {
      loadSpreadsheetPreview();
    }
  }, [url]);

  const loadSpreadsheetPreview = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Extract filename from URL
      const urlParts = url.split('/');
      const fileNameFromUrl = urlParts[urlParts.length - 1] || 'Spreadsheet';
      setFileName(fileNameFromUrl.replace(/\.[^/.]+$/, "")); // Remove extension
      
      // Add timeout for network requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 second timeout for larger files
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,*/*'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Spreadsheet not found (404)');
        } else if (response.status === 403) {
          throw new Error('Access denied to spreadsheet (403)');
        } else if (response.status >= 500) {
          throw new Error('Server error - please try again later');
        } else {
          throw new Error(`Failed to fetch spreadsheet (${response.status})`);
        }
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      // Validate file size (max 15MB for preview)
      if (arrayBuffer.byteLength === 0) {
        throw new Error('Spreadsheet file is empty');
      }
      
      if (arrayBuffer.byteLength > 15 * 1024 * 1024) {
        throw new Error('Spreadsheet is too large to preview (max 15MB)');
      }
      
      await parseExcelFile(arrayBuffer);
    } catch (err) {
      console.error('Error loading spreadsheet preview:', err);
      
      if (err.name === 'AbortError') {
        setError('Request timed out - please check your connection and try again');
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load spreadsheet preview';
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const parseExcelFile = async (arrayBuffer) => {
    try {
      // Check for Excel file signatures
      const uint8Array = new Uint8Array(arrayBuffer);
      const isXLSX = uint8Array[0] === 0x50 && uint8Array[1] === 0x4B; // ZIP signature (XLSX)
      const isXLS = uint8Array[0] === 0xD0 && uint8Array[1] === 0xCF; // OLE signature (XLS)
      
      if (!isXLSX && !isXLS) {
        throw new Error('File does not appear to be a valid Excel file');
      }
      
      // Check minimum file size
      if (arrayBuffer.byteLength < 1000) {
        throw new Error('File is too small to be a valid Excel document');
      }
      
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('No sheets found in the Excel file');
      }
      
      const sheets = [];
      
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        if (worksheet) {
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          sheets.push({
            name: sheetName,
            data: jsonData
          });
        }
      });
      
      if (sheets.length === 0) {
        throw new Error('No valid data found in the Excel file');
      }
      
      setSheetsData(sheets);
      setActiveSheet(0);
    } catch (err) {
      console.error('Error parsing Excel file:', err);
      
      // Provide user-friendly error messages
      if (err.message.includes('not appear to be a valid Excel')) {
        throw err;
      } else if (err.message.includes('too small to be a valid')) {
        throw err;
      } else if (err.message.includes('No sheets found')) {
        throw err;
      } else if (err.message.includes('No valid data found')) {
        throw err;
      } else if (err.message.includes('Unsupported file')) {
        throw new Error('This Excel file format is not supported for preview');
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        throw new Error(`Failed to parse Excel file: ${errorMessage}`);
      }
    }
  };

  const handleDownload = async () => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Cannot open this spreadsheet type');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to open spreadsheet');
    }
  };

  const renderSheetTabs = () => {
    if (sheetsData.length <= 1) return null;
    
    return (
      <ScrollView 
        horizontal 
        style={[styles.sheetTabsContainer, { borderBottomColor: colors.border }]}
        showsHorizontalScrollIndicator={false}
      >
        {sheetsData.map((sheet, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => setActiveSheet(index)}
            style={[
              styles.sheetTab,
              {
                borderBottomColor: activeSheet === index ? colors.primary : 'transparent',
                backgroundColor: activeSheet === index ? colors.surface : 'transparent',
              }
            ]}
          >
            <Text style={[
              styles.sheetTabText,
              {
                color: activeSheet === index ? colors.primary : colors.textSecondary,
                fontWeight: activeSheet === index ? '600' : '400',
              }
            ]}>
              {sheet.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const renderTableCell = ({ item: cell, index: cellIndex }) => (
    <View style={[
      styles.tableCell,
      {
        borderColor: colors.border,
        backgroundColor: cellIndex === 0 ? colors.surface : 'transparent',
      }
    ]}>
      <Text style={[
        styles.tableCellText,
        {
          color: colors.text,
          fontWeight: cellIndex === 0 ? '600' : '400',
        }
      ]} numberOfLines={3}>
        {String(cell || '')}
      </Text>
    </View>
  );

  const renderTableRow = ({ item: row, index: rowIndex }) => (
    <View style={[
      styles.tableRow,
      {
        backgroundColor: rowIndex === 0 ? colors.surface : 
                        rowIndex % 2 === 0 ? colors.background : colors.surface + '40',
      }
    ]}>
      <FlatList
        data={row.slice(0, 10)} // Limit to 10 columns for mobile display
        renderItem={renderTableCell}
        keyExtractor={(item, index) => `cell-${rowIndex}-${index}`}
        horizontal
        showsHorizontalScrollIndicator={true}
        style={styles.tableRowList}
      />
    </View>
  );

  const renderSpreadsheetPreview = () => {
    if (!sheetsData || sheetsData.length === 0) return null;
    
    const currentSheet = sheetsData[activeSheet];
    if (!currentSheet || !currentSheet.data) return null;
    
    const displayData = currentSheet.data.slice(0, 100); // Limit to 100 rows
    
    return (
      <View style={styles.spreadsheetContainer}>
        {renderSheetTabs()}
        
        <View style={styles.tableContainer}>
          <FlatList
            data={displayData}
            renderItem={renderTableRow}
            keyExtractor={(item, index) => `row-${index}`}
            showsVerticalScrollIndicator={true}
            style={styles.tableList}
          />
          
          {currentSheet.data.length > 100 && (
            <View style={[styles.tableFooter, { backgroundColor: colors.surface }]}>
              <Text style={[styles.tableFooterText, { color: colors.textSecondary }]}>
                Showing first 100 rows of {currentSheet.data.length} total rows
              </Text>
            </View>
          )}
        </View>
        

      </View>
    );
  };

  return (
    <View style={[styles.viewerContainer, { backgroundColor: colors.background }]}>
      {loading && (
        <View style={[styles.loadingContainer, { backgroundColor: colors.background + 'E6' }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading spreadsheet...</Text>
        </View>
      )}
      
      {error && (
        <View style={styles.errorContainer}>
          <Icon name="error" size={48} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>Failed to load spreadsheet</Text>
          <Text style={[styles.errorSubtext, { color: colors.textSecondary }]}>{error}</Text>
          <TouchableOpacity 
            style={[styles.downloadButton, { backgroundColor: colors.primary, marginTop: 16 }]}
            onPress={handleDownload}
          >
            <Icon name="open-in-new" size={20} color="white" />
            <Text style={styles.downloadButtonText}>Open Externally</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {sheetsData.length > 0 && !loading && !error && renderSpreadsheetPreview()}
    </View>
  );
};

// Generic File Viewer Component
export const FileViewer = ({ url, fileType, colors, onClose }) => {
  switch (fileType.toLowerCase()) {
    case 'pdf':
      return <PDFViewer url={url} colors={colors} onClose={onClose} />;
    case 'docx':
    case 'doc':
      return <DOCXViewer url={url} colors={colors} onClose={onClose} />;
    case 'xlsx':
    case 'xls':
      return <XLSXViewer url={url} colors={colors} onClose={onClose} />;
    default:
        return (
          <View style={[styles.viewerContainer, { backgroundColor: colors.background }]}>
            <View style={styles.errorContainer}>
              <Icon name="description" size={48} color={colors.textSecondary} />
              <Text style={[styles.errorText, { color: colors.text }]}>Preview not available</Text>
              <Text style={[styles.errorSubtext, { color: colors.textSecondary }]}>
                This file type cannot be previewed directly
              </Text>
            </View>
          </View>
        );
  }
};

const styles = StyleSheet.create({
  viewerContainer: {
    flex: 1,
  },
  pdf: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  documentPreviewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  documentTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  documentSubtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  downloadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Document content styles
  documentContentContainer: {
    flex: 1,
  },
  documentContent: {
    padding: 16,
    flex: 1,
  },
  documentText: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'left',
  },
  documentActions: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  // Spreadsheet styles
  spreadsheetContainer: {
    flex: 1,
  },
  sheetTabsContainer: {
    borderBottomWidth: 1,
    paddingHorizontal: 8,
  },
  sheetTab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    marginRight: 8,
  },
  sheetTabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  tableContainer: {
    flex: 1,
  },
  tableList: {
    flex: 1,
  },
  tableRow: {
    flexDirection: 'row',
    minHeight: 40,
  },
  tableRowList: {
    flex: 1,
  },
  tableCell: {
    minWidth: 100,
    maxWidth: 200,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    justifyContent: 'center',
  },
  tableCellText: {
    fontSize: 12,
    textAlign: 'left',
  },
  tableFooter: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    alignItems: 'center',
  },
  tableFooterText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  spreadsheetActions: {
    padding: 16,
    paddingBottom: 20, // Extra bottom padding for safe area
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    backgroundColor: 'transparent',
    position: 'relative',
    bottom: 0,
  },
});

export default FileViewer;