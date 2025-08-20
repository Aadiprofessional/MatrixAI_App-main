import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Modal,
    ScrollView,
    FlatList,
    Dimensions,
    Alert,
    Switch,
    ActivityIndicator,
    Image,
    Platform,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Clipboard from '@react-native-clipboard/clipboard';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import audioService from '../services/audioService';
import paymentService from '../services/paymentService';
import { useCoinsSubscription } from '../hooks/useCoinsSubscription';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Helper function to format time in SRT format (HH:MM:SS,mmm)
const formatSRTTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
};

// Helper function to format time for display (MM:SS)
const formatDisplayTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

// Helper function to detect Chinese text
const isChinese = (text) => {
    return /[\u4e00-\u9fff]/.test(text);
};

// Helper function to remove spaces from Chinese text
const formatChineseText = (text) => {
    if (isChinese(text)) {
        // Remove spaces between Chinese characters but keep spaces around non-Chinese characters
        return text.replace(/([\u4e00-\u9fff])\s+([\u4e00-\u9fff])/g, '$1$2');
    }
    return text;
};

const SRTSubtitleModal = ({ 
    visible, 
    onClose, 
    wordsData, 
    currentTime, 
    onTimeSeek,
    colors,
    isDarkMode = false,
    uid 
}) => {
    const [srtSegments, setSrtSegments] = useState([]);
    const [currentSegmentIndex, setCurrentSegmentIndex] = useState(-1);
    const [translatedSegments, setTranslatedSegments] = useState([]);
    const [isTranslating, setIsTranslating] = useState(false);

    const [hasTranslation, setHasTranslation] = useState(false);
    const [selectedLanguage, setSelectedLanguage] = useState('zh');
    const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
    const scrollViewRef = useRef(null);
    const segmentRefs = useRef({});
    const { t } = useTranslation();
    const coinCount = useCoinsSubscription(uid);
    const coin = require('../assets/coin.png');

    // Available languages for translation
    const languages = [
        { code: 'en', name: t('english') },
        { code: 'zh', name: t('chinese') },
        { code: 'es', name: t('spanish') },
        { code: 'fr', name: t('french') },
        { code: 'de', name: t('german') },
        { code: 'ja', name: t('japanese') },
        { code: 'ko', name: 'Korean' },
        { code: 'pt', name: 'Portuguese' },
        { code: 'ru', name: 'Russian' },
        { code: 'ar', name: 'Arabic' },
        { code: 'hi', name: 'Hindi' },
    ];

    // Process words data into SRT segments (8-second intervals)
    useEffect(() => {
        if (!wordsData || !Array.isArray(wordsData) || wordsData.length === 0) {
            setSrtSegments([]);
            return;
        }

        const segments = [];
        const segmentDuration = 6; // 6 seconds per segment
        let currentSegment = {
            id: 1,
            startTime: 0,
            endTime: segmentDuration,
            words: [],
            text: ''
        };

        // Filter valid words with timing data
        const validWords = wordsData.filter(word => 
            word && 
            typeof word.start === 'number' && 
            typeof word.end === 'number' && 
            !isNaN(word.start) && 
            !isNaN(word.end) && 
            word.start >= 0 && 
            word.end >= word.start &&
            (word.punctuated_word || word.word)
        );

        if (validWords.length === 0) {
            setSrtSegments([]);
            return;
        }

        // Group words into 6-second segments starting from zero
        for (let i = 0; i < validWords.length; i++) {
            const word = validWords[i];
            const wordText = word.punctuated_word || word.word;

            // If word starts after current segment end time, create new segment
            if (word.start >= currentSegment.endTime) {
                // Finalize current segment if it has words
                if (currentSegment.words.length > 0) {
                    const segmentText = currentSegment.words.map(w => w.punctuated_word || w.word).join(' ');
                    currentSegment.text = formatChineseText(segmentText);
                    segments.push(currentSegment);
                }

                // Create new segment - ensure segments start from 0 and increment by segmentDuration
                const segmentStartTime = segments.length * segmentDuration;
                currentSegment = {
                    id: segments.length + 1,
                    startTime: segmentStartTime,
                    endTime: segmentStartTime + segmentDuration,
                    words: [word],
                    text: ''
                };
            } else {
                // Add word to current segment
                currentSegment.words.push(word);
            }
        }

        // Add the last segment if it has words
        if (currentSegment.words.length > 0) {
            const segmentText = currentSegment.words.map(w => w.punctuated_word || w.word).join(' ');
            currentSegment.text = formatChineseText(segmentText);
            segments.push(currentSegment);
        }

        setSrtSegments(segments);
    }, [wordsData]);

    // Update current segment based on current time
    useEffect(() => {
        if (srtSegments.length === 0 || typeof currentTime !== 'number') {
            setCurrentSegmentIndex(-1);
            return;
        }

        const activeSegmentIndex = srtSegments.findIndex(segment => 
            currentTime >= segment.startTime && currentTime < segment.endTime
        );

        if (activeSegmentIndex !== currentSegmentIndex) {
            setCurrentSegmentIndex(activeSegmentIndex);
            
            // Auto-scroll to current segment
            if (activeSegmentIndex >= 0 && scrollViewRef.current && segmentRefs.current[activeSegmentIndex]) {
                setTimeout(() => {
                    segmentRefs.current[activeSegmentIndex]?.measureLayout(
                        scrollViewRef.current,
                        (x, y) => {
                            scrollViewRef.current?.scrollTo({
                                y: Math.max(0, y - 100),
                                animated: true
                            });
                        },
                        () => {}
                    );
                }, 100);
            }
        }
    }, [currentTime, srtSegments, currentSegmentIndex]);

    const handleSegmentPress = (segment) => {
        if (onTimeSeek && typeof segment.startTime === 'number') {
            onTimeSeek(segment.startTime);
        }
    };

    // Copy text to clipboard
    const handleCopyText = (text) => {
        Clipboard.setString(text);
        Toast.show({
            type: 'success',
            text1: 'Copied',
            text2: 'Text copied to clipboard',
            position: 'bottom',
            visibilityTime: 2000,
        });
    };

    // Edit segment text
    const handleEditSegment = (segment, index) => {
        Alert.prompt(
            'Edit Segment',
            `Edit the text for segment ${segment.id}:`,
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: 'Save',
                    onPress: (newText) => {
                        if (newText && newText.trim()) {
                            // Update the segment text in srtSegments
                            const updatedSegments = [...srtSegments];
                            updatedSegments[index] = {
                                ...updatedSegments[index],
                                text: newText.trim()
                            };
                            setSrtSegments(updatedSegments);

                            // If there are translated segments, update them too
                            if (hasTranslation && translatedSegments.length > 0) {
                                const updatedTranslatedSegments = [...translatedSegments];
                                if (updatedTranslatedSegments[index]) {
                                    updatedTranslatedSegments[index] = {
                                        ...updatedTranslatedSegments[index],
                                        text: newText.trim()
                                    };
                                    setTranslatedSegments(updatedTranslatedSegments);
                                }
                            }

                            Toast.show({
                                type: 'success',
                                text1: 'Updated',
                                text2: 'Segment text has been updated',
                                position: 'bottom',
                                visibilityTime: 2000,
                            });
                        }
                    },
                },
            ],
            'plain-text',
            segment.text
        );
    };

    // Translation functionality
    const translateSubtitles = async () => {
        if (!uid) {
            Alert.alert('Error', 'User not authenticated');
            return;
        }

        if (srtSegments.length === 0) {
            Alert.alert('Error', 'No subtitles to translate');
            return;
        }

        if (coinCount < 1) {
            Alert.alert('Insufficient Coins', 'You need at least 1 coin to translate subtitles.');
            return;
        }

        try {
            setIsTranslating(true);
            
            // Deduct 1 coin
            await paymentService.subtractCoins(uid, 1, 'Subtitle Translation');

            const translatedResults = [];
            const azureKey = process.env.AZURE_TRANSLATION_KEY || '';
            const region = 'eastus';
            
            for (const segment of srtSegments) {
                try {
                    const data = await audioService.translateText(
                        segment.text,
                        selectedLanguage,
                        azureKey,
                        region
                    );
                    
                    if (data && data[0] && data[0].translations && data[0].translations[0]) {
                        const translation = data[0].translations[0].text;
                        translatedResults.push({
                            ...segment,
                            text: formatChineseText(translation),
                        });
                    } else {
                        translatedResults.push({
                            ...segment,
                            text: segment.text, // Fallback to original
                        });
                    }
                } catch (error) {
                    console.error('Translation error for segment:', error);
                    translatedResults.push({
                        ...segment,
                        text: segment.text, // Fallback to original
                    });
                }
            }
            
            setTranslatedSegments(translatedResults);
            setHasTranslation(true);


            Toast.show({
                type: 'success',
                text1: 'Translation Complete',
                text2: `Subtitles translated to ${languages.find(lang => lang.code === selectedLanguage)?.name}`,
                position: 'bottom',
            });
            
        } catch (error) {
            console.error('Translation error:', error);
            Alert.alert('Error', 'Failed to translate subtitles. Please try again.');
        } finally {
            setIsTranslating(false);
        }
    };

    // Download SRT functionality
    const downloadSRT = async () => {
        if (srtSegments.length === 0) {
            Alert.alert('Error', 'No subtitles to download');
            return;
        }

        try {
            // Generate SRT content
            let srtContent = '';
            const segmentsToUse = hasTranslation && translatedSegments.length > 0 ? translatedSegments : srtSegments;
            
            segmentsToUse.forEach((segment, index) => {
                srtContent += `${segment.id}\n`;
                srtContent += `${formatSRTTime(segment.startTime)} --> ${formatSRTTime(segment.endTime)}\n`;
                srtContent += `${segment.text}\n\n`;
            });

            // Create file path
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `subtitles_${timestamp}.txt`;
            const filePath = `${RNFS.DocumentDirectoryPath}/${fileName}`;

            // Write file
            await RNFS.writeFile(filePath, srtContent, 'utf8');

            // Share the file
            const shareOptions = {
                title: 'Share Subtitles',
                message: 'Subtitles Text File',
                url: Platform.OS === 'android' ? `file://${filePath}` : filePath,
                type: 'text/plain',
                filename: fileName,
            };

            await Share.open(shareOptions);

            Toast.show({
                type: 'success',
                text1: 'Subtitles Downloaded',
                text2: 'Subtitles file has been created and shared',
                position: 'bottom',
                visibilityTime: 2000,
            });

        } catch (error) {
            console.error('Error downloading SRT:', error);
            Alert.alert('Error', 'Failed to download subtitles file. Please try again.');
        }
    };

    // Get current segments to display
    const currentSegments = srtSegments;

    // Get theme colors based on dark mode
    const getThemeColors = () => {
        if (isDarkMode) {
            return {
                background: '#000000',
                surface: '#1a1a1a',
                text: '#ffffff',
                textSecondary: '#cccccc',
                border: '#333333',
                primary: '#007BFF',
                cardBackground: '#2d2d2d',
                isDarkMode: true,
            };
        }
        return {
            background: '#ffffff',
            surface: '#f8f9fa',
            text: '#333333',
            textSecondary: '#666666',
            primary: '#007BFF',
            border: '#e0e0e0',
            cardBackground: '#ffffff',
            isDarkMode: false,
        };
    };

    const themeColors = getThemeColors();

    const renderSegment = ({ item, index }) => {
        const isActive = index === currentSegmentIndex;
        
        return (
            <View
                ref={ref => segmentRefs.current[index] = ref}
                style={[
                    styles.segmentContainer,
                    { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border },
                    isActive && { backgroundColor: themeColors.primary + '20', borderColor: themeColors.primary }
                ]}
            >
                <View style={styles.segmentHeader}>
                    <TouchableOpacity
                        onPress={() => handleSegmentPress(item)}
                        style={styles.segmentNumberContainer}
                    >
                        <Text style={[
                            styles.segmentNumber,
                            { color: themeColors.text }
                        ]}>
                            {item.id}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.timeIntervalContainer}
                        onPress={() => handleSegmentPress(item)}
                    >
                        <Text style={[
                            styles.segmentTime,
                            { color: themeColors.textSecondary }
                        ]}>
                            {formatSRTTime(item.startTime)} {'->'} {formatSRTTime(item.endTime)}
                        </Text>
                    </TouchableOpacity>
                    <View style={styles.actionButtonsContainer}>
                        <TouchableOpacity
                            style={[styles.editButton, { backgroundColor: themeColors.secondary || '#6c757d' }]}
                            onPress={() => handleEditSegment(item, index)}
                        >
                            <MaterialIcons name="edit" size={10} color="#ffffff" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.copyButton, { backgroundColor: themeColors.primary }]}
                            onPress={() => handleCopyText(item.text)}
                        >
                            <MaterialIcons name="content-copy" size={10} color="#ffffff" />
                        </TouchableOpacity>
                    </View>
                </View>
                <TouchableOpacity onPress={() => {
                    handleSegmentPress(item);
                    handleCopyText(item.text);
                }}>
                    <Text style={[
                        styles.segmentText,
                        isActive && styles.activeSegmentText,
                        { 
                            color: isActive ? themeColors.primary : themeColors.text,
                            fontWeight: isActive ? '600' : '400'
                        }
                    ]}>
                        {item.text}
                    </Text>
                    {hasTranslation && translatedSegments[index] && (
                        <Text style={[
                            styles.translatedText,
                            { 
                                color: isActive ? themeColors.primary : themeColors.textSecondary,
                                fontWeight: isActive ? '500' : '400'
                            }
                        ]}>
                            {translatedSegments[index].text}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
        );
    };

    if (!visible) return null;

    return (
        <Modal
            transparent={true}
            animationType="slide"
            visible={visible}
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.modalOverlay}>
                    <TouchableWithoutFeedback onPress={() => {}}>
                        <View style={[
                            styles.modalContainer,
                            { backgroundColor: themeColors.background }
                        ]}>
                            {/* Header */}
                            <View style={[
                                styles.modalHeader,
                                { borderBottomColor: themeColors.border }
                            ]}>
                                <View style={styles.headerLeft}>
                                    <MaterialIcons 
                                        name="subtitles" 
                                        size={24} 
                                        color={themeColors.primary} 
                                    />
                                    <Text style={[
                                        styles.modalTitle,
                                        { color: themeColors.text }
                                    ]}>
                                        {t('srtSubtitles')}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={onClose}
                                    style={styles.closeButton}
                                >
                                    <Ionicons 
                                        name="close" 
                                        size={24} 
                                        color={themeColors.text} 
                                    />
                                </TouchableOpacity>
                            </View>

                            {/* Translation Controls */}
                            <View style={[
                                styles.translationControls,
                                { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }
                            ]}>
                                {/* Language Selection - Moved to top */}
                                <TouchableOpacity
                                    style={[styles.languageDropdown, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                                    onPress={() => setShowLanguageDropdown(!showLanguageDropdown)}
                                >
                                    <Text style={[styles.languageDropdownText, { color: themeColors.text }]}>
                                        {t('targetLanguage')}: {languages.find(lang => lang.code === selectedLanguage)?.name || 'Select Language'}
                                    </Text>
                                </TouchableOpacity>

                                {/* Action Buttons Row */}
                                <View style={styles.actionButtonsRow}>
                                    {/* Translate Button */}
                                    <TouchableOpacity
                                        style={[styles.actionButton, { opacity: isTranslating ? 0.7 : 1 }]}
                                        onPress={translateSubtitles}
                                        disabled={isTranslating}
                                    >
                                        {isTranslating ? (
                                            <View style={[styles.gradientButton, { backgroundColor: '#1D8EC4' }]}>
                                                <ActivityIndicator size="small" color="#ffffff" />
                                            </View>
                                        ) : (
                                            <LinearGradient
                                                colors={['#13EF97', '#1D8EC4']}
                                                style={styles.gradientButton}
                                                start={{ x: 1, y: 0 }}
                                                end={{ x: 0, y: 0 }}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <Text style={styles.translateButtonText}>{t('translate')} -1</Text>
                                                    <Image source={coin} style={[styles.coinIcon, { marginLeft: 5 }]} />
                                                </View>
                                            </LinearGradient>
                                        )}
                                    </TouchableOpacity>

                                    {/* Download SRT Button */}
                                    <TouchableOpacity
                                        style={[styles.actionButton, styles.downloadButton]}
                                        onPress={downloadSRT}
                                        disabled={srtSegments.length === 0}
                                    >
                                        <LinearGradient
                                            colors={['#13EF97', '#1D8EC4']}
                                            style={styles.gradientButton}
                                            start={{ x: 1, y: 0 }}
                                            end={{ x: 0, y: 0 }}
                                        >
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <MaterialIcons name="download" size={16} color="#ffffff" style={{ marginRight: 5 }} />
                                                <Text style={styles.downloadButtonText}>{t('downloadSRT') || 'Download SRT'}</Text>
                                            </View>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>



                                {showLanguageDropdown && (
                                    <View style={styles.languageDropdownOverlay}>
                                        <TouchableWithoutFeedback onPress={() => setShowLanguageDropdown(false)}>
                                            <View style={styles.languageDropdownBackdrop} />
                                        </TouchableWithoutFeedback>
                                        <View style={[styles.languageList, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                                             <ScrollView style={styles.languageScrollView} showsVerticalScrollIndicator={true}>
                                                 {languages.map((language) => (
                                                     <TouchableOpacity
                                                         key={language.code}
                                                         style={[styles.languageOption, { borderBottomColor: themeColors.border }]}
                                                         onPress={() => {
                                                             setSelectedLanguage(language.code);
                                                             setShowLanguageDropdown(false);
                                                         }}
                                                     >
                                                         <Text style={[styles.languageOptionText, { color: themeColors.text }]}>{language.name}</Text>
                                                     </TouchableOpacity>
                                                 ))}
                                             </ScrollView>
                                         </View>
                                    </View>
                                )}
                                
                                {isTranslating && (
                                    <View style={styles.loadingContainer}>
                                        <ActivityIndicator size="small" color={themeColors.primary} />
                                        <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>Translating subtitles...</Text>
                                    </View>
                                )}
                            </View>

                            {/* Content */}
                            <View style={styles.modalContent}>
                                {currentSegments.length > 0 ? (
                                    <>
                                        <Text style={[
                                            styles.infoText,
                                            { color: themeColors.textSecondary }
                                        ]}>
                                            {currentSegments.length} subtitle segments • Tap to jump to time
                                        </Text>
                                        <FlatList
                                            ref={scrollViewRef}
                                            data={currentSegments}
                                            renderItem={renderSegment}
                                            keyExtractor={(item) => item.id.toString()}
                                            showsVerticalScrollIndicator={true}
                                            contentContainerStyle={styles.listContainer}
                                            getItemLayout={(data, index) => ({
                                                length: 100, // Approximate item height
                                                offset: 100 * index,
                                                index,
                                            })}
                                        />
                                    </>
                                ) : (
                                    <View style={styles.emptyContainer}>
                                        <MaterialIcons 
                                            name="subtitles-off" 
                                            size={48} 
                                            color={themeColors.textSecondary} 
                                        />
                                        <Text style={[
                                            styles.emptyText,
                                            { color: themeColors.textSecondary }
                                        ]}>
                                            No subtitle data available
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        width: screenWidth * 0.9,
        height: screenHeight * 0.8,
        backgroundColor: '#fff',
        borderRadius: 16,
        overflow: 'visible',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        position: 'relative',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginLeft: 8,
        color: '#333',
    },
    closeButton: {
        padding: 4,
    },
    translationControls: {
        padding: 16,
        borderBottomWidth: 1,
        position: 'relative',
        zIndex: 1,
    },
    translationRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    actionButtonsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginVertical: 12,
        gap: 8,
    },
    actionButton: {
        flex: 1,
        borderRadius: 8,
        overflow: 'hidden',
    },
    downloadButton: {
        opacity: 1,
    },
    gradientButton: {
        width: '100%',
        height: 48,
      
        paddingHorizontal: 16,
        
        alignItems: 'center',

        justifyContent: 'center',
        borderRadius: 8,
    },
    translateLabel: {
        fontSize: 16,
        fontWeight: '500',
    },
    translateButtonText: {
        color: '#ffffff',
        fontSize: 14,
        marginLeft: -18,
        fontWeight: '600',
    },
    downloadButtonText: {
        color: '#ffffff',
        fontSize: 10,
        fontWeight: '600',
        marginRight: 30,
    },
    coinIcon: {
        width: 16,
        height: 16,
        resizeMode: 'contain',
    },

    languageDropdown: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        marginTop: 8,
        marginBottom: 8,
    },
    languageDropdownText: {
        fontSize: 14,
        fontWeight: '500',
    },
    languageDropdownOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        justifyContent: 'flex-start',
        paddingTop: 60,
    },
    languageDropdownBackdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'transparent',
    },
    languageList: {
        maxHeight: 250,
        marginHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    languageScrollView: {
        maxHeight: 250,
    },
    languageOption: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    languageOptionText: {
        fontSize: 14,
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
        gap: 8,
    },
    loadingText: {
        fontSize: 14,
    },
    modalContent: {
        flex: 1,
        padding: 16,
    },
    infoText: {
        fontSize: 14,
        color: '#666',
        marginBottom: 16,
        textAlign: 'center',
    },
    listContainer: {
        paddingBottom: 20,
    },
    segmentContainer: {
        padding: 12,
        marginBottom: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    activeSegmentContainer: {
        borderColor: '#007BFF',
        borderWidth: 2,
    },
    segmentHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        paddingHorizontal: 4,
    },
    segmentNumberContainer: {
        width: 40,
        alignItems: 'center',
    },
    timeIntervalContainer: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 8,
    },

    actionButtonsContainer: {
        flexDirection: 'row',
        gap: 4,
    },
    editButton: {
        backgroundColor: '#6c757d',
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 3,
        width: 24,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    copyButton: {
        backgroundColor: '#007BFF',
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 3,
        width: 24,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    segmentNumber: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        minWidth: 30,
    },
    segmentTime: {
        fontSize: 9,
        color: '#666',
        fontFamily: 'monospace',
        textAlign: 'center',
        numberOfLines: 1,
        flexShrink: 1,
    },
    segmentDisplayTime: {
        fontSize: 12,
        color: '#666',
        fontWeight: '500',
        minWidth: 40,
        textAlign: 'right',
    },
    segmentText: {
        fontSize: 16,
        lineHeight: 22,
        color: '#333',
    },
    activeSegmentText: {
        color: '#007BFF',
        fontWeight: '600',
    },
    translatedText: {
        fontSize: 14,
        lineHeight: 20,
        marginTop: 4,
        fontStyle: 'italic',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: '#666',
        marginTop: 16,
        textAlign: 'center',
    },
});

export default SRTSubtitleModal;