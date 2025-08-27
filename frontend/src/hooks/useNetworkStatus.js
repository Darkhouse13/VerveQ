import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const OFFLINE_QUEUE_KEY = '@verveq_offline_queue';
const NETWORK_CHECK_INTERVAL = 5000;

export const useNetworkStatus = () => {
  const [isConnected, setIsConnected] = useState(true);
  const [connectionType, setConnectionType] = useState('unknown');
  const [isInternetReachable, setIsInternetReachable] = useState(true);
  const [connectionSpeed, setConnectionSpeed] = useState('unknown');
  const [offlineQueue, setOfflineQueue] = useState([]);
  
  const lastCheckRef = useRef(Date.now());
  const speedTestRef = useRef(null);
  const retryTimeoutRef = useRef(null);

  // Initialize network status with periodic checks
  useEffect(() => {
    // Load offline queue from storage
    loadOfflineQueue();

    // Initial connection test
    testConnection();

    // Periodic connection testing
    const interval = setInterval(testConnection, NETWORK_CHECK_INTERVAL);

    return () => {
      clearInterval(interval);
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  const testConnection = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('https://httpbin.org/status/200', {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-cache',
      });

      clearTimeout(timeoutId);

      const wasConnected = isConnected && isInternetReachable;
      const nowConnected = response.ok;

      setIsConnected(nowConnected);
      setIsInternetReachable(nowConnected);
      setConnectionType(nowConnected ? 'wifi' : 'none');

      // Process offline queue when connection is restored
      if (!wasConnected && nowConnected) {
        processOfflineQueue();
      }
    } catch (error) {
      setIsConnected(false);
      setIsInternetReachable(false);
      setConnectionType('none');
    }
  }, [isConnected, isInternetReachable, processOfflineQueue]);

  // Connection speed testing
  useEffect(() => {
    if (isConnected && isInternetReachable) {
      testConnectionSpeed();
    }
  }, [isConnected, isInternetReachable]);

  const testConnectionSpeed = useCallback(async () => {
    if (!isConnected) return;

    try {
      const start = Date.now();
      const response = await fetch('https://httpbin.org/json', {
        method: 'GET',
        cache: 'no-cache',
      });
      
      if (response.ok) {
        const end = Date.now();
        const duration = end - start;
        const size = JSON.stringify(await response.json()).length;
        const speedKbps = (size * 8) / (duration / 1000) / 1024;

        if (speedKbps > 1000) {
          setConnectionSpeed('fast');
        } else if (speedKbps > 100) {
          setConnectionSpeed('medium');
        } else {
          setConnectionSpeed('slow');
        }
      }
    } catch (error) {
      setConnectionSpeed('unknown');
    }
  }, [isConnected]);

  const loadOfflineQueue = async () => {
    try {
      const queueData = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      if (queueData) {
        setOfflineQueue(JSON.parse(queueData));
      }
    } catch (error) {
      console.warn('Failed to load offline queue:', error);
    }
  };

  const saveOfflineQueue = async (queue) => {
    try {
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.warn('Failed to save offline queue:', error);
    }
  };

  const addToOfflineQueue = useCallback((action) => {
    const queueItem = {
      id: Date.now().toString(),
      action,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3,
    };

    setOfflineQueue(prevQueue => {
      const newQueue = [...prevQueue, queueItem];
      saveOfflineQueue(newQueue);
      return newQueue;
    });

    return queueItem.id;
  }, []);

  const removeFromOfflineQueue = useCallback((itemId) => {
    setOfflineQueue(prevQueue => {
      const newQueue = prevQueue.filter(item => item.id !== itemId);
      saveOfflineQueue(newQueue);
      return newQueue;
    });
  }, []);

  const processOfflineQueue = useCallback(async () => {
    if (offlineQueue.length === 0) return;

    for (const item of offlineQueue) {
      try {
        // Execute the queued action
        if (typeof item.action === 'function') {
          await item.action();
          removeFromOfflineQueue(item.id);
        }
      } catch (error) {
        console.warn('Failed to process offline queue item:', error);
        
        // Increment retry count
        if (item.retryCount < item.maxRetries) {
          setOfflineQueue(prevQueue =>
            prevQueue.map(queueItem =>
              queueItem.id === item.id
                ? { ...queueItem, retryCount: queueItem.retryCount + 1 }
                : queueItem
            )
          );
        } else {
          // Remove item if max retries exceeded
          removeFromOfflineQueue(item.id);
        }
      }
    }
  }, [offlineQueue, removeFromOfflineQueue]);

  const checkConnection = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch('https://httpbin.org/status/200', {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-cache',
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      return false;
    }
  }, []);

  const retryConnection = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }

    retryTimeoutRef.current = setTimeout(async () => {
      const isOnline = await checkConnection();
      if (isOnline) {
        processOfflineQueue();
      } else {
        // Exponential backoff for retries
        const delay = Math.min(30000, 1000 * Math.pow(2, Math.floor(Date.now() / 5000) % 5));
        retryTimeoutRef.current = setTimeout(retryConnection, delay);
      }
    }, 2000);
  }, [checkConnection, processOfflineQueue]);

  const getConnectionStatus = useCallback(() => {
    return {
      isOnline: isConnected && isInternetReachable,
      isConnected,
      isInternetReachable,
      connectionType,
      connectionSpeed,
      hasOfflineActions: offlineQueue.length > 0,
      offlineActionCount: offlineQueue.length,
    };
  }, [isConnected, isInternetReachable, connectionType, connectionSpeed, offlineQueue.length]);

  return {
    isConnected,
    isInternetReachable,
    connectionType,
    connectionSpeed,
    offlineQueue,
    isOnline: isConnected && isInternetReachable,
    hasOfflineActions: offlineQueue.length > 0,
    addToOfflineQueue,
    removeFromOfflineQueue,
    processOfflineQueue,
    checkConnection,
    retryConnection,
    getConnectionStatus,
  };
};

export default useNetworkStatus;