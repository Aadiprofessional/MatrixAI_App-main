import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useCoinsSubscription } from '../hooks/useCoinsSubscription';
import { useAuth } from '../hooks/useAuth';

const FeatureCardWithDetailsAddon = () => {
    const navigation = useNavigation();
    const { uid } = useAuth();
    const coinCount = useCoinsSubscription(uid);

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <View style={styles.titleContainer}>
                    <Text style={styles.title}>Low Coin Balance</Text>
                    <View style={styles.warningBadge}>
                        <Text style={styles.warningText}>ACTION NEEDED</Text>
                    </View>
                </View>
            </View>
            
            <View style={styles.coinInfoContainer}>
                <Image source={require('../assets/coin.png')} style={styles.coinIcon} />
                <Text style={styles.coinCountText}>{coinCount}</Text>
                <Text style={styles.coinBalanceText}>Current Balance</Text>
            </View>
            
            <Text style={styles.warningMessage}>
                Your coin balance is running low. Some Pro features may require additional coins.
            </Text>
            
            <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => navigation.navigate('AddonScreen')}
            >
                <Text style={styles.actionButtonText}>Purchase More Coins</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFF8E1',
        borderRadius: 15,
      
        marginVertical: 10,
        padding: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#FFE082',
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#E65100',
    },
    warningBadge: {
        backgroundColor: '#FF9800',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        marginLeft: 10,
    },
    warningText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 10,
    },
    coinInfoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 10,
    },
    coinIcon: {
        width: 30,
        height: 30,
        marginRight: 10,
    },
    coinCountText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FF6600',
        marginRight: 10,
    },
    coinBalanceText: {
        fontSize: 14,
        color: '#666',
    },
    warningMessage: {
        fontSize: 14,
        color: '#333',
        marginVertical: 10,
        lineHeight: 20,
    },
    actionButton: {
        backgroundColor: '#FF6600',
        paddingVertical: 12,
        borderRadius: 25,
        alignItems: 'center',
        marginTop: 10,
    },
    actionButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
});

export default FeatureCardWithDetailsAddon;
