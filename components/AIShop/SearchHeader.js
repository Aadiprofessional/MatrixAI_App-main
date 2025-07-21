import React, { useRef, useEffect, useState } from 'react';
import axios from 'axios';

import {
  View,
  Text,
  TextInput,
  Image,
  Animated,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';

import { supabase } from '../../supabaseClient';

import * as Animatable from 'react-native-animatable';

import AsyncStorage from '@react-native-async-storage/async-storage';

import Icon from 'react-native-vector-icons/Feather';

import Header from '../Header';
import { useCart } from '../CartContext';
import { useAuth } from '../../hooks/useAuth';
import { useCoinsSubscription } from '../../hooks/useCoinsSubscription';
import { useFocusEffect } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const SearchHeader = ({ scrollY, navigation = { navigate: () => {} }, closeDropdown, openDropdown, isDropdownVisible }) => {
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const isDropdownOpenRef = useRef(false);

  const handlePressOutside = (event) => {
    // If the input is focused, don't close the dropdown
    if (isInputFocused) {
      return;
    }
    
    // Only close the dropdown if we're clicking outside both the dropdown and the search input
    if (
      dropdownRef.current && 
      !dropdownRef.current.contains(event.target) &&
      searchInputRef.current &&
      !searchInputRef.current.contains(event.target)
    ) {
      setShowDropdown(false);
      if (closeDropdown) {
        closeDropdown();
      }
    }
  };

  // Add a state to track if the input is focused
  const [isInputFocused, setIsInputFocused] = useState(false);

  // Use useFocusEffect to handle screen focus/blur events
  useFocusEffect(
    React.useCallback(() => {
      // When screen comes into focus, no action needed
      
      // When screen loses focus, close dropdown and blur input
      return () => {
        setShowDropdown(false);
        if (searchInputRef.current) {
          searchInputRef.current.blur();
        }
        if (closeDropdown) {
          closeDropdown();
        }
      };
    }, [closeDropdown])
  );

  const { uid, loading } = useAuth();
  const { addToCart, cart } = useCart();
console.log('useCart result:', { addToCart, cart }); // Log the result of useCart
  const [isSeller, setIsSeller] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    if (uid) {
      checkUserStatus();
    }
  }, [uid]);

  const checkUserStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('seller, verified')
        .eq('uid', uid)
        .single();

      if (error) throw error;

      if (data) {
        setIsSeller(data.seller);
        setIsVerified(data.verified);
      }
    } catch (error) {
      console.error('Error checking user status:', error.message);
    }
  };
  
  const searchBoxHeight = useRef(new Animated.Value(250)).current; // Keep this as a ref
  const backgroundContainerHeight = useRef(new Animated.Value(200)).current; // Keep this as a ref
  const backgroundOpacity = useRef(new Animated.Value(1)).current; // Keep this as a ref
  const titleOpacity = useRef(new Animated.Value(1)).current; // Keep this as a ref
  const plusTop = useRef(new Animated.Value(10)).current; // Keep this as a ref
  const plusRight = useRef(new Animated.Value(10)).current; // Keep this as a ref
  const cartLeft = useRef(new Animated.Value(10)).current; // Keep this as a ref

  const [typingText, setTypingText] = useState('');
  const coinCount = useCoinsSubscription(uid);

  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  // Update the ref whenever showDropdown changes
 


  const [searchHeight, setSearchHeight] = useState(250);

  // Add an effect to handle touches outside the search box and dropdown
 
  useEffect(() => {
    fetchProducts();
    
    const targetText = "Let's see the AI world";
    let index = 0;
    setTypingText(''); // Clear text before restarting animation
    const interval = setInterval(() => {
      setTypingText(targetText.slice(0, index + 1));
      index += 1;
      if (index > targetText.length) clearInterval(interval);
    }, 100);

    return () => clearInterval(interval); // Cleanup on unmount
  }, []);
  
  const fetchProducts = async () => {
    try {
      const response = await axios.get('https://main-matrixai-server-lujmidrakh.cn-hangzhou.fcapp.run/getAllProducts');
      const allProducts = [
        ...response.data.images.map(item => ({...item, type: 'image'})),
        ...response.data.videos.map(item => ({...item, type: 'video'})),
        ...response.data.music.map(item => ({...item, type: 'music'}))
      ];
      setProducts(allProducts);
      setFilteredProducts(allProducts.slice(0, 3));
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleSearch = (text) => {
    // Update search query
    setSearchQuery(text);
    
    // Filter products based on search query
    if (text) {
      const filtered = products.filter(product =>
        product.name.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredProducts(filtered);
      
      // Ensure dropdown is visible
      if (!showDropdown) {
        setShowDropdown(true);
        if (openDropdown) openDropdown();
      }
    } else {
      // If search query is empty, show first 3 products
      setFilteredProducts(products.slice(0, 3));
      
      // Don't close dropdown when text is cleared
      // Let the user explicitly close it by clicking outside
    }
  };

  const handleSearchNavigation = () => {
    if (searchQuery.trim()) {
      // Close dropdown and blur input before navigating
      setShowDropdown(false);
      if (searchInputRef.current) {
        searchInputRef.current.blur();
      }
      
      if (closeDropdown) {
        closeDropdown();
      }
      
      // Use setTimeout to ensure navigation happens after state updates
      setTimeout(() => {
        navigation.navigate('SearchScreen', {searchQuery});
      }, 100);
    }
  };

  useEffect(() => {
    const scrollThreshold = 150; // Adjust threshold as needed

    const listenerId = scrollY.addListener(({ value }) => {
      const progress = Math.min(value / scrollThreshold, 1);

      // Update the height of the search box from 250 to 50
      searchBoxHeight.setValue(250 * (1 - progress) + 50 * progress); // Use setValue on the Animated.Value

      // Update the background image visibility based on scroll
      backgroundOpacity.setValue(Math.max(1 - progress, 0)); // Update opacity based on scroll

      // Update the height of the background container
      backgroundContainerHeight.setValue(200 * (1 - progress) + 50 * progress); // From 200 to 50

      // Adjust title opacity to fade out smoothly
      titleOpacity.setValue(1 - (progress * 2)); // Fade out based on scroll progress

      // Plus button animations
      plusTop.setValue(10 * (1.5 - progress));
      plusRight.setValue(10);
      cartLeft.setValue(10);
    });

    return () => {
      scrollY.removeListener(listenerId); // Clean up listener
    };
  }, [scrollY]); // Ensure scrollY is included in the dependency array

  return (
    <View style={styles.container2} pointerEvents="box-none">
      <View pointerEvents="box-none">
        <View style={styles.fixedHeader}>
          <Header navigation={navigation} uid={uid} />
        </View>

        <Animated.View style={[
          styles.container,
          { height: backgroundContainerHeight } // Use the animated height
        ]} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.backgroundImageContainer,
              {
                backgroundColor: scrollY.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['transparent', '#007BFF'],
                  extrapolate: 'clamp',
                }),
              },
            ]}
          >
            <Animated.Image
              source={require('../../assets/AIShop.png')}
              style={[
                styles.backgroundImage,
                {
                  opacity: scrollY.interpolate({
                    inputRange: [0, 100],
                    outputRange: [1, 0],
                    extrapolate: 'clamp',
                  }),
                },
              ]}
            />
          </Animated.View>

          <View style={styles.titleContainer}>
            <Animated.Text
              style={[
                styles.title,
                { opacity: titleOpacity },
              ]}
            >
              {typingText !== '' && (
                <View style={styles.speechBubble}>
                  <Animatable.Text animation="fadeIn" style={styles.typingText}>
                    {typingText}
                  </Animatable.Text>
                </View>
              )}
            </Animated.Text>
          </View>
        
          <Animated.View
            style={[
              styles.searchAndDropdownContainer,
              { 
                height: searchBoxHeight,
                pointerEvents: 'box-none'
              }
            ]}
          >
            <TouchableOpacity 
              activeOpacity={1}
              style={[styles.searchBox, { zIndex: 109 }]}
              onPress={() => {
                // Focus the input when the container is pressed
                if (searchInputRef.current) {
                  searchInputRef.current.focus();
                }
              }}
            >
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder="Search your products"
                placeholderTextColor="#9F9F9FFF"
                value={searchQuery}
                onChangeText={handleSearch}
                onSubmitEditing={handleSearchNavigation}
                onFocus={() => {
                  // Set input as focused
                  setIsInputFocused(true);
                  // Show dropdown
                  setShowDropdown(true);
                
                }}
                onBlur={() => {
                  // Set input as not focused
                  setIsInputFocused(false);
                  // Don't close dropdown here, let it be handled by touch events
                }}
                returnKeyType="search"
              />
              <TouchableOpacity 
                onPress={handleSearchNavigation} 
                style={styles.icon}
              >
                <Icon name="search" size={20} color="#484848" />
              </TouchableOpacity>
            </TouchableOpacity>
          </Animated.View>


          
          <Animated.View
            style={[
              styles.plusContainer,
              {
                top: plusTop,
                left: cartLeft,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.cartButton}
              onPress={() => {
                // Close dropdown and blur input before navigating
                setShowDropdown(false);
                if (searchInputRef.current) {
                  searchInputRef.current.blur();
                }
                navigation.navigate('Cart');
              }}
            >
              <View style={styles.cartIconContainer}>
                <Icon name="shopping-cart" size={24} color="white" />
                {cart.length > 0 && (
                  <View style={styles.cartItemCount}>
                    <Text style={styles.cartItemCountText}>{cart.length}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </Animated.View>
          {isSeller && isVerified && (
            <Animated.View
              style={[
                styles.plusContainer,
                {
                  top: plusTop,
                  right: plusRight,
                },
              ]}
            >
              <TouchableOpacity onPress={() => {
                // Close dropdown and blur input before navigating
                setShowDropdown(false);
                if (searchInputRef.current) {
                  searchInputRef.current.blur();
                }
                navigation.navigate('AddProductScreen');
              }}>
                <Image
                  source={require('../../assets/plus.png')}
                  style={styles.plusIcon}
                />
              </TouchableOpacity>
            </Animated.View>
          )}
        </Animated.View>

        {showDropdown && (
          <Animated.View
            ref={dropdownRef}
            style={[
              styles.dropdown,
              {
                top: searchBoxHeight.interpolate({
                  inputRange: [50, 250], // Adjust these based on your min/max search box height
                  outputRange: [100, 200], // 50 + 10 to 250 + 10
                }),
                zIndex: 9999 // Added higher zIndex
              },
            ]}
            pointerEvents="auto"
          >
            {filteredProducts.length > 0 ? (
              filteredProducts.map((product, index) => {
                const navigateToDetail = () => {
                  // Close dropdown and blur input before navigating
                  setShowDropdown(false);
                  if (searchInputRef.current) {
                    searchInputRef.current.blur();
                  }
                  
                  if (closeDropdown) {
                    closeDropdown();
                  }
                  
                  // Use setTimeout to ensure navigation happens after state updates
                  setTimeout(() => {
                    if (product.type === 'music') {
                      navigation.navigate('ProductDetail', { musicproductid: product.musicproductid });
                    } else if (product.type === 'video') {
                      navigation.navigate('ProductDetail', { videoproductid: product.videoproductid });
                    } else if (product.type === 'image') {
                      navigation.navigate('ProductDetail', { imageproductid: product.imageproductid });
                    }
                  }, 100);
                };

                return (
                  <TouchableOpacity 
                    key={index} 
                    onPress={navigateToDetail} 
                    style={styles.dropdownItem}
                  >
                    <Text>{product.name} ({product.type})</Text>
                  </TouchableOpacity>
                );
              })
            ) : (
              <Text style={styles.noResultsText}>No results found</Text>
            )}
          </Animated.View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
    backgroundColor: '#fff', // Debugging background color
  },
  container2: {
    zIndex: 1, // Ensure the main container has a lower zIndex
  },
  typingText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  backgroundImageContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    padding: 0,
    margin: 0,
    zIndex: 2, // Ensure the background image is below the dropdown
  },
  backgroundImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    alignSelf: 'center',
    resizeMode: 'cover',
    left: 0,
    right: 0,
  },
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 50,
    zIndex: 3, // Ensure the header is below the dropdown
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  titleContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 4, // Ensure the title is below the dropdown
  },
  title: {
    fontWeight: 'bold',
    color: '#fff',
  },
  searchAndDropdownContainer: {
    position: 'absolute',
    width: '70%',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    zIndex: 1100, // Ensure the search container is above other content
    paddingVertical: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    width: '100%',
    position: 'relative',
    zIndex: 1200, // Increased z-index
    elevation: 5, // Add elevation for Android
    shadowColor: '#000', // Add shadow for iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    fontSize: 16,
    flex: 1,
    paddingRight: 50,
    zIndex: 1300, // Increased z-index
  },
  plusContainer: {
    position: 'absolute',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000, // Ensure the plus container is below the dropdown
  },
  plusIcon: {
    width: 25,
    height: 25,
    tintColor: '#fff'
  },
  icon: {
    position: 'absolute',
    right: 10,
    tintColor: '#007BFF',
    zIndex: 1300, // Increased z-index
  },
  cartButton: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  cartIconContainer: {
    position: 'relative',
    width: 24,
    height: 24,
  },  
  cartItemCount: {
    position: 'absolute',
    top: -5,
    right: -10,
    backgroundColor: 'red',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  cartItemCountText: {
    color: 'white',
    fontWeight: 'bold',
  },
  dropdown: {
    position: 'absolute',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 10, // Increased elevation for Android
    width: '70%',
    alignItems: 'center',
    alignSelf: 'center',
    zIndex: 1500, // Increased z-index to be above everything
    maxHeight: 300, // Limit the height of the dropdown
    overflow: 'scroll', // Allow scrolling if there are many items
    left: '15%', // Center the dropdown (100% - 70%) / 2
  },
  dropdownItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    width: '100%',
  },
  noResultsText: {
    padding: 10,
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
  },
});

// Wrap the component with React.memo to prevent unnecessary re-renders
export default React.memo(SearchHeader, (prevProps, nextProps) => {
  // Only re-render if isDropdownVisible changes or scrollY changes significantly
  const scrollYChanged = Math.abs(prevProps.scrollY?._value - nextProps.scrollY?._value) > 5;
  const dropdownVisibilityChanged = prevProps.isDropdownVisible !== nextProps.isDropdownVisible;
  
  return !scrollYChanged && !dropdownVisibilityChanged;
});
