import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { getCoinsCount, saveCoinsCount } from '../utils/proStatusUtils';

export const useCoinsSubscription = (uid) => {
    const [coinCount, setCoinCount] = useState(null);

    useEffect(() => {
        let mounted = true;
        let channel;
        let fetchRetryCount = 0;
        const MAX_RETRIES = 3;
        
        // Load cached coins first
        const loadCachedCoins = async () => {
            try {
                const cachedCoins = await getCoinsCount();
                if (mounted && cachedCoins !== null) {
                    setCoinCount(cachedCoins);
                    console.log('Loaded cached coins:', cachedCoins);
                }
            } catch (error) {
                console.error('Error loading cached coins:', error);
            }
        };
        
        loadCachedCoins();
        
        const setupCoinSubscription = async (userUid) => {
            if (!userUid) {
                console.log("No UID available to fetch coins");
                return;
            }

            try {
                // Initial fetch with retry logic
                const fetchCoinsWithRetry = async () => {
                    try {
                        const { data, error } = await supabase
                            .from('users')
                            .select('user_coins')
                            .eq('uid', userUid)
                            .single();

                        if (error) throw error;

                        if (data && mounted) {
                            console.log(`Initial coins fetched for ${userUid}:`, data.user_coins);
                            setCoinCount(data.user_coins);
                            // Save to cache
                            saveCoinsCount(data.user_coins);
                            fetchRetryCount = 0; // Reset retry count on success
                        }
                        
                        return true; // Success
                    } catch (error) {
                        console.error(`Attempt ${fetchRetryCount + 1}: Error fetching coins:`, error);
                        fetchRetryCount++;
                        
                        if (fetchRetryCount < MAX_RETRIES) {
                            // Wait with exponential backoff before retrying
                            const delay = Math.pow(2, fetchRetryCount) * 1000;
                            console.log(`Retrying in ${delay}ms...`);
                            await new Promise(resolve => setTimeout(resolve, delay));
                            return false; // Continue retrying
                        } else {
                            console.error('Max retries reached for fetching coins');
                            return true; // Stop retrying
                        }
                    }
                };
                
                // Try initial fetch until success or max retries
                let fetchSuccess = false;
                while (!fetchSuccess && fetchRetryCount < MAX_RETRIES) {
                    fetchSuccess = await fetchCoinsWithRetry();
                }

                // Create a unique channel name for this subscription
                const channelName = `coins-${userUid}-${Math.random()}`;
                console.log(`Setting up channel: ${channelName}`);

                // Set up real-time subscription
                channel = supabase.channel(channelName);

                channel
                    .on(
                        'postgres_changes',
                        {
                            event: '*',
                            schema: 'public',
                            table: 'users',
                            filter: `uid=eq.${userUid}`,
                        },
                        (payload) => {
                            console.log(`Received update for ${userUid}:`, payload);
                            if (mounted && payload.new?.user_coins !== undefined) {
                                console.log(`Setting new coin count: ${payload.new.user_coins}`);
                                setCoinCount(payload.new.user_coins);
                                // Save the updated value to cache
                                saveCoinsCount(payload.new.user_coins);
                            }
                        }
                    )
                    .subscribe((status) => {
                        console.log(`Subscription status for ${userUid}:`, status);
                    });

                return channel;
            } catch (error) {
                console.error(`Error in coin subscription for ${userUid}:`, error);
            }
        };

        if (uid) {
            console.log(`Initializing subscription for UID: ${uid}`);
            setupCoinSubscription(uid);
        }

        return () => {
            mounted = false;
            if (channel) {
                console.log(`Cleaning up subscription for UID: ${uid}`);
                channel.unsubscribe();
                supabase.removeChannel(channel);
            }
        };
    }, [uid]);

    return coinCount !== null ? coinCount : 0;
}; 