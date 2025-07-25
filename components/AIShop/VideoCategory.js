import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import ImageDealsSection from './ImageDealsSection';
import VideoDealsSection from './VideoDealsSection';
import MusicDealsSection from './MusicDealsSection';
import Banner from './Banner';

const VideoCategory = ({ navigation }) => {
  const [bestDeals, setBestDeals] = useState([]);
  const[highlight,setHighlight]=useState([]);
  const [bestVideoDeals, setBestVideoDeals] = useState([]);
  const [bestMusicDeals, setBestMusicDeals] = useState([]);
  const [musicHighlight, setMusicHighlight] = useState([]);
  const [videoHighlight, setVideoHighlight] = useState([]);
  const [loading, setLoading] = useState(true);
  const [videoLoading, setVideoLoading] = useState(true);
  const [musicHighlightLoading, setMusicHighlightLoading] = useState(true);
  const [videoHighlightLoading, setVideoHighlightLoading] = useState(true);
  const [imageHighlightLoading, setImageHighlightLoading] = useState(true);
  
  const [musicLoading, setMusicLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageHighlightError, setImageHighlightError] = useState(false);
  const [videoHighlightError, setVideoHighlightError] = useState(false);
  const [musicHighlightError, setMusicHighlightError] = useState(false);
  const [musicError, setMusicError] = useState(false);



  useEffect(() => {
   

    const fetchHighlightVideo = async () => {
      try {
        const response = await fetch('https://main-matrixai-server-lujmidrakh.cn-hangzhou.fcapp.run/getHighlightsVideoProduct');
        const data = await response.json();
        setVideoHighlight(data);
      } catch (error) {
        console.error('Error fetching best deals:', error);
        setVideoHighlightError(true);
      } finally {
        setVideoHighlightLoading(false);
      }
    };

   
    const fetchBestVideoDeals = async () => {
      try {
        const response = await fetch('https://main-matrixai-server-lujmidrakh.cn-hangzhou.fcapp.run/getBestDealsVideoProduct');
        const data = await response.json();
        setBestVideoDeals(data);
      } catch (error) {
        console.error('Error fetching video deals:', error);
        setVideoError(true);
      } finally {
        setVideoLoading(false);
      }
    };

   
    fetchBestVideoDeals();
    fetchHighlightVideo();
  }, []);

  const handleSeeAllPress = (category, type) => {
    navigation.navigate('SeeAllScreen', { category, type });
  };

  return (
    <View style={styles.container}>
    
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Best In Videos</Text>
        <TouchableOpacity onPress={() => handleSeeAllPress('Videos', 'Best Deals')}>
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>
      <VideoDealsSection
        bestVideoDeals={bestVideoDeals}
        videoLoading={videoLoading}
        videoError={videoError}
        navigation={navigation}
      />

      <Banner />
        <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Highlighted Videos</Text>
        <TouchableOpacity onPress={() => handleSeeAllPress('Videos', 'Highlighted')}>
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>
      <VideoDealsSection
        bestVideoDeals={videoHighlight}
        videoLoading={videoHighlightLoading}
        videoError={videoHighlightError}
        navigation={navigation}
      />

<Banner />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 0,
  },
  scrollContainer: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 10,
    marginVertical: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  seeAll: {
    color: 'orange',
    fontSize: 14,
  },
  errorText: {
    textAlign: 'center',
    color: 'red',
    marginVertical: 20,
  },
  cardList: {
    paddingLeft: 10,
  },
});

export default VideoCategory;
