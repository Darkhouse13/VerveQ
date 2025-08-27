import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import useNetworkStatus from '../../hooks/useNetworkStatus';

const { width } = Dimensions.get('window');

const ConnectionStatus = ({
  showWhenOnline = false,
  autoHide = true,
  position = 'top',
  style,
  ...props
}) => {
  const { theme } = useTheme();
  const {
    isOnline,
    connectionSpeed,
    hasOfflineActions,
    offlineActionCount,
    retryConnection,
    processOfflineQueue,
  } = useNetworkStatus();

  const [visible, setVisible] = useState(false);
  const [slideAnim] = useState(new Animated.Value(0));
  const [opacityAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    const shouldShow = !isOnline || (showWhenOnline && isOnline) || hasOfflineActions;
    
    if (shouldShow && !visible) {
      setVisible(true);
      showBanner();
    } else if (!shouldShow && visible && autoHide) {
      hideBanner();
    }
  }, [isOnline, hasOfflineActions, showWhenOnline, visible, autoHide]);

  const showBanner = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const hideBanner = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
    });
  };

  const handleRetry = () => {
    retryConnection();
    if (hasOfflineActions) {
      processOfflineQueue();
    }
  };

  const getStatusConfig = () => {
    if (!isOnline) {
      return {
        type: 'offline',
        icon: '📶',
        title: 'You\'re Offline',
        message: 'Check your connection and try again',
        backgroundColor: theme.colors.error.main,
        textColor: '#ffffff',
        showRetry: true,
      };
    }

    if (hasOfflineActions) {
      return {
        type: 'syncing',
        icon: '🔄',
        title: 'Syncing Changes',
        message: `${offlineActionCount} pending action${offlineActionCount !== 1 ? 's' : ''}`,
        backgroundColor: theme.colors.secondary.amber,
        textColor: '#ffffff',
        showRetry: true,
      };
    }

    if (showWhenOnline) {
      const speedConfig = {
        fast: { icon: '🚀', message: 'Fast connection' },
        medium: { icon: '📡', message: 'Good connection' },
        slow: { icon: '🐌', message: 'Slow connection' },
        unknown: { icon: '📶', message: 'Connected' },
      };

      const config = speedConfig[connectionSpeed] || speedConfig.unknown;

      return {
        type: 'online',
        icon: config.icon,
        title: 'Online',
        message: config.message,
        backgroundColor: theme.colors.success.main,
        textColor: '#ffffff',
        showRetry: false,
      };
    }

    return null;
  };

  if (!visible) {
    return null;
  }

  const statusConfig = getStatusConfig();
  if (!statusConfig) {
    return null;
  }

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: position === 'top' ? [-100, 0] : [100, 0],
  });

  return (
    <Animated.View
      style={[
        styles(theme, statusConfig).container,
        {
          opacity: opacityAnim,
          transform: [{ translateY }],
          [position]: 0,
        },
        style
      ]}
      {...props}
    >
      <View style={styles(theme).content}>
        <Text style={styles(theme, statusConfig).icon}>
          {statusConfig.icon}
        </Text>
        
        <View style={styles(theme).textContent}>
          <Text style={styles(theme, statusConfig).title}>
            {statusConfig.title}
          </Text>
          <Text style={styles(theme, statusConfig).message}>
            {statusConfig.message}
          </Text>
        </View>

        {statusConfig.showRetry && (
          <TouchableOpacity
            style={styles(theme, statusConfig).retryButton}
            onPress={handleRetry}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles(theme, statusConfig).retryText}>
              {statusConfig.type === 'syncing' ? 'Sync' : 'Retry'}
            </Text>
          </TouchableOpacity>
        )}

        {!autoHide && (
          <TouchableOpacity
            style={styles(theme).closeButton}
            onPress={hideBanner}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles(theme, statusConfig).closeText}>×</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

export const OfflineIndicator = () => {
  const { isOnline } = useNetworkStatus();
  const { theme } = useTheme();

  if (isOnline) return null;

  return (
    <View style={styles(theme).offlineIndicator}>
      <Text style={styles(theme).offlineText}>📶 Offline</Text>
    </View>
  );
};

const styles = (theme, config = {}) => StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: config.backgroundColor || theme.colors.mode.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    zIndex: 1000,
    ...theme.elevation.lg,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 16,
    marginRight: theme.spacing.sm,
  },
  textContent: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  title: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    color: config.textColor || theme.colors.mode.text,
  },
  message: {
    fontSize: theme.typography.sizes.xs,
    color: config.textColor || theme.colors.mode.textSecondary,
    marginTop: 2,
  },
  retryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    marginRight: theme.spacing.sm,
  },
  retryText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
    color: config.textColor || theme.colors.mode.text,
  },
  closeButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  closeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: config.textColor || theme.colors.mode.text,
  },
  offlineIndicator: {
    backgroundColor: theme.colors.error.main,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    alignSelf: 'flex-start',
  },
  offlineText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
    color: '#ffffff',
  },
});

export default ConnectionStatus;