import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import Button from './Button';
import EmptyState from './EmptyState';
import useNetworkStatus from '../../hooks/useNetworkStatus';

const ErrorFallback = ({
  error,
  resetError,
  context = 'general',
  retryAction,
  showDetails = __DEV__,
  style,
  ...props
}) => {
  const { theme, styles: themeStyles } = useTheme();
  const { isOnline, retryConnection } = useNetworkStatus();
  const [retrying, setRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [lastRetryTime, setLastRetryTime] = useState(null);

  const maxRetries = 3;
  const retryDelays = [1000, 3000, 5000]; // Progressive delays

  useEffect(() => {
    // Auto-retry for network errors when connection is restored
    if (isNetworkError(error) && isOnline && retryCount === 0) {
      handleRetry();
    }
  }, [isOnline]);

  const isNetworkError = (err) => {
    if (!err) return false;
    const message = err.message?.toLowerCase() || '';
    return (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('timeout') ||
      message.includes('connection') ||
      err.name === 'NetworkError'
    );
  };

  const getErrorConfig = () => {
    if (!error) {
      return {
        type: 'unknown',
        title: 'Something Went Wrong',
        message: 'An unexpected error occurred. Please try again.',
        icon: '❌',
        canRetry: true,
      };
    }

    if (isNetworkError(error)) {
      return {
        type: 'network',
        title: 'Connection Problem',
        message: isOnline 
          ? 'Failed to load data. Please check your connection and try again.'
          : 'You\'re offline. Please check your internet connection.',
        icon: '📶',
        canRetry: true,
      };
    }

    if (error.message?.includes('404')) {
      return {
        type: 'notFound',
        title: 'Content Not Found',
        message: 'The content you\'re looking for doesn\'t exist or has been moved.',
        icon: '🔍',
        canRetry: false,
      };
    }

    if (error.message?.includes('403') || error.message?.includes('401')) {
      return {
        type: 'auth',
        title: 'Access Denied',
        message: 'You don\'t have permission to access this content.',
        icon: '🔒',
        canRetry: false,
      };
    }

    if (error.message?.includes('500')) {
      return {
        type: 'server',
        title: 'Server Error',
        message: 'Our servers are having trouble. Please try again in a moment.',
        icon: '🔧',
        canRetry: true,
      };
    }

    // Context-specific errors
    const contextConfigs = {
      quiz: {
        title: 'Quiz Loading Failed',
        message: 'Unable to load the quiz questions. Please try again.',
        icon: '🎯',
      },
      leaderboard: {
        title: 'Leaderboard Unavailable',
        message: 'Unable to load the leaderboard rankings. Please try again.',
        icon: '🏆',
      },
      profile: {
        title: 'Profile Loading Failed',
        message: 'Unable to load the user profile. Please try again.',
        icon: '👤',
      },
      challenges: {
        title: 'Challenges Unavailable',
        message: 'Unable to load your challenges. Please try again.',
        icon: '⚡',
      },
    };

    const contextConfig = contextConfigs[context] || {};

    return {
      type: 'general',
      title: contextConfig.title || 'Something Went Wrong',
      message: contextConfig.message || 'An unexpected error occurred. Please try again.',
      icon: contextConfig.icon || '❌',
      canRetry: true,
    };
  };

  const handleRetry = async () => {
    if (retrying || retryCount >= maxRetries) return;

    setRetrying(true);
    setRetryCount(prev => prev + 1);
    setLastRetryTime(Date.now());

    try {
      // If it's a network error, test connection first
      if (isNetworkError(error) && !isOnline) {
        await retryConnection();
      }

      // Wait for progressive delay
      const delay = retryDelays[retryCount] || retryDelays[retryDelays.length - 1];
      await new Promise(resolve => setTimeout(resolve, delay));

      // Execute retry action or reset error
      if (retryAction) {
        await retryAction();
      } else {
        resetError?.();
      }
    } catch (retryError) {
      console.warn('Retry failed:', retryError);
      // If this was the last retry, don't reset
      if (retryCount >= maxRetries) {
        setRetrying(false);
        return;
      }
    } finally {
      setRetrying(false);
    }
  };

  const handleReset = () => {
    setRetryCount(0);
    setLastRetryTime(null);
    resetError?.();
  };

  const errorConfig = getErrorConfig();

  const getRetryButtonText = () => {
    if (retrying) return 'Retrying...';
    if (retryCount > 0) return `Retry (${retryCount}/${maxRetries})`;
    return 'Try Again';
  };

  const canRetry = errorConfig.canRetry && retryCount < maxRetries && !retrying;

  return (
    <View style={[styles(theme).container, style]} {...props}>
      <EmptyState
        type="error"
        title={errorConfig.title}
        message={errorConfig.message}
        illustration={errorConfig.icon}
        actionText={canRetry ? getRetryButtonText() : undefined}
        onActionPress={canRetry ? handleRetry : undefined}
        secondaryActionText={retryCount > 0 ? "Reset" : "Go Back"}
        onSecondaryActionPress={retryCount > 0 ? handleReset : undefined}
      />

      {retrying && (
        <View style={styles(theme).retryingContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary[500]} />
          <Text style={styles(theme).retryingText}>
            Attempting to reconnect...
          </Text>
        </View>
      )}

      {/* Network status indicator */}
      {isNetworkError(error) && !isOnline && (
        <View style={styles(theme).networkStatus}>
          <Text style={styles(theme).networkStatusText}>
            📶 Currently offline
          </Text>
        </View>
      )}

      {/* Retry history */}
      {retryCount > 0 && lastRetryTime && (
        <View style={styles(theme).retryHistory}>
          <Text style={styles(theme).retryHistoryText}>
            Last attempt: {new Date(lastRetryTime).toLocaleTimeString()}
          </Text>
          {retryCount >= maxRetries && (
            <Text style={styles(theme).maxRetriesText}>
              Maximum retry attempts reached
            </Text>
          )}
        </View>
      )}

      {/* Error details for development */}
      {showDetails && error && (
        <View style={styles(theme).debugContainer}>
          <TouchableOpacity
            style={styles(theme).debugToggle}
            onPress={() => console.log('Error details:', error)}
          >
            <Text style={styles(theme).debugToggleText}>
              View Error Details (Console)
            </Text>
          </TouchableOpacity>
          
          <Text style={styles(theme).debugTitle}>Error Details:</Text>
          <Text style={styles(theme).debugText} numberOfLines={5}>
            {error.message || 'Unknown error'}
          </Text>
          {error.stack && (
            <Text style={styles(theme).debugText} numberOfLines={10}>
              {error.stack}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

export const withErrorFallback = (Component, contextType) => {
  return (props) => {
    const [error, setError] = useState(null);

    const resetError = () => setError(null);

    if (error) {
      return (
        <ErrorFallback 
          error={error}
          resetError={resetError}
          context={contextType}
        />
      );
    }

    try {
      return <Component {...props} onError={setError} />;
    } catch (err) {
      setError(err);
      return (
        <ErrorFallback 
          error={err}
          resetError={resetError}
          context={contextType}
        />
      );
    }
  };
};

const styles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  retryingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.mode.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.mode.border,
  },
  retryingText: {
    marginLeft: theme.spacing.sm,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.mode.textSecondary,
  },
  networkStatus: {
    alignItems: 'center',
    marginTop: theme.spacing.md,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.error.light,
    borderRadius: theme.borderRadius.sm,
  },
  networkStatusText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.error.dark,
    fontWeight: theme.typography.weights.medium,
  },
  retryHistory: {
    alignItems: 'center',
    marginTop: theme.spacing.md,
    padding: theme.spacing.sm,
  },
  retryHistoryText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.mode.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  maxRetriesText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.error.main,
    fontWeight: theme.typography.weights.medium,
  },
  debugContainer: {
    marginTop: theme.spacing.xl,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.mode.background,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.error.main,
  },
  debugToggle: {
    alignSelf: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  debugToggleText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.primary[500],
    textDecorationLine: 'underline',
  },
  debugTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.error.dark,
    marginBottom: theme.spacing.sm,
  },
  debugText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.mode.textSecondary,
    fontFamily: 'monospace',
    marginBottom: theme.spacing.sm,
  },
});

export default ErrorFallback;