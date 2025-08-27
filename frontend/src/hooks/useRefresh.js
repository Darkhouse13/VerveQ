import { useState, useCallback, useRef } from 'react';
import useNetworkStatus from './useNetworkStatus';

const useRefresh = ({
  onRefresh,
  dependencies = [],
  minRefreshInterval = 1000,
  maxRetries = 3,
  timeout = 10000,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  
  const refreshTimeoutRef = useRef(null);
  const { isOnline, addToOfflineQueue } = useNetworkStatus();

  const refresh = useCallback(async (force = false) => {
    // Prevent rapid refresh attempts
    const now = Date.now();
    if (!force && lastRefresh && (now - lastRefresh) < minRefreshInterval) {
      return;
    }

    // If offline, queue the refresh for later
    if (!isOnline && !force) {
      addToOfflineQueue(() => refresh(true));
      return;
    }

    if (refreshing) return;

    setRefreshing(true);
    setError(null);

    // Set timeout for refresh operation
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = setTimeout(() => {
      if (refreshing) {
        setError(new Error('Refresh timeout'));
        setRefreshing(false);
      }
    }, timeout);

    try {
      await onRefresh?.();
      setLastRefresh(now);
      setRetryCount(0);
      setError(null);
    } catch (refreshError) {
      console.warn('Refresh failed:', refreshError);
      setError(refreshError);
      
      // Auto-retry logic for network errors
      if (isNetworkError(refreshError) && retryCount < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          refresh(true);
        }, delay);
        return; // Don't set refreshing to false yet
      }
    } finally {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      setRefreshing(false);
    }
  }, [onRefresh, lastRefresh, minRefreshInterval, refreshing, isOnline, addToOfflineQueue, retryCount, maxRetries, timeout]);

  const isNetworkError = (error) => {
    const message = error?.message?.toLowerCase() || '';
    return (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('timeout') ||
      message.includes('connection') ||
      error?.name === 'NetworkError'
    );
  };

  const reset = useCallback(() => {
    setRefreshing(false);
    setError(null);
    setRetryCount(0);
    setLastRefresh(null);
    
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
  }, []);

  const canRefresh = !refreshing && (
    !lastRefresh || 
    (Date.now() - lastRefresh) >= minRefreshInterval
  );

  return {
    refreshing,
    refresh,
    canRefresh,
    lastRefresh,
    error,
    retryCount,
    isRetrying: retryCount > 0,
    reset,
  };
};

export default useRefresh;