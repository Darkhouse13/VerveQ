import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Animated,
  TouchableOpacity,
  Dimensions
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const { width } = Dimensions.get('window');

const ToastNotification = ({
  visible = false,
  type = 'success', // 'success', 'achievement', 'challenge', 'rank', 'error'
  title,
  message,
  icon,
  duration = 4000,
  onDismiss,
  swipeable = true,
  style,
  ...props
}) => {
  const { theme } = useTheme();
  const [slideAnim] = useState(new Animated.Value(-100));
  const [opacityAnim] = useState(new Animated.Value(0));
  const typeConfig = {
    success: {
      backgroundColor: theme.colors.success.light,
      borderColor: theme.colors.success.main,
      iconColor: theme.colors.success.dark,
      textColor: theme.colors.success.dark,
      defaultIcon: '✅'
    },
    achievement: {
      backgroundColor: theme.colors.secondary.amber + '20',
      borderColor: theme.colors.secondary.amber,
      iconColor: theme.colors.secondary.amber,
      textColor: theme.colors.mode.text,
      defaultIcon: '🏆'
    },
    challenge: {
      backgroundColor: theme.colors.secondary.coral + '20',
      borderColor: theme.colors.secondary.coral,
      iconColor: theme.colors.secondary.coral,
      textColor: theme.colors.mode.text,
      defaultIcon: '⚡'
    },
    rank: {
      backgroundColor: theme.colors.secondary.emerald + '20',
      borderColor: theme.colors.secondary.emerald,
      iconColor: theme.colors.secondary.emerald,
      textColor: theme.colors.mode.text,
      defaultIcon: '📈'
    },
    error: {
      backgroundColor: theme.colors.error.light,
      borderColor: theme.colors.error.main,
      iconColor: theme.colors.error.dark,
      textColor: theme.colors.error.dark,
      defaultIcon: '❌'
    }
  };

  const config = typeConfig[type] || typeConfig.success;

  useEffect(() => {
    if (visible) {
      // Show animation
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss
      if (duration > 0) {
        const timer = setTimeout(() => {
          dismiss();
        }, duration);

        return () => clearTimeout(timer);
      }
    } else {
      dismiss();
    }
  }, [visible, duration]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss?.();
    });
  };

  // Simplified swipe handling removed for compatibility

  if (!visible && slideAnim._value === -100) {
    return null;
  }

  const ToastContent = (
    <Animated.View
      style={[
        styles(theme, config).container,
        {
          opacity: opacityAnim,
          transform: [
            { translateY: slideAnim }
          ],
        },
        style
      ]}
      {...props}
    >
      {/* Progress Bar */}
      {duration > 0 && (
        <Animated.View
          style={[
            styles(theme, config).progressBar,
            {
              width: opacityAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      )}

      {/* Content */}
      <View style={styles(theme).content}>
        {/* Icon */}
        <View style={[styles(theme, config).iconContainer]}>
          <Text style={[styles(theme, config).icon]}>
            {icon || config.defaultIcon}
          </Text>
        </View>

        {/* Text Content */}
        <View style={styles(theme).textContent}>
          {title && (
            <Text style={[styles(theme, config).title]} numberOfLines={1}>
              {title}
            </Text>
          )}
          {message && (
            <Text style={[styles(theme, config).message]} numberOfLines={2}>
              {message}
            </Text>
          )}
        </View>

        {/* Dismiss Button */}
        <TouchableOpacity
          style={styles(theme).dismissButton}
          onPress={dismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles(theme, config).dismissIcon]}>×</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  return ToastContent;
};

// Toast Manager Component
export const ToastManager = ({ toasts = [], onRemoveToast }) => {
  const { theme } = useTheme();

  return (
    <View style={styles(theme).manager}>
      {toasts.map((toast, index) => (
        <ToastNotification
          key={toast.id || index}
          visible={true}
          type={toast.type}
          title={toast.title}
          message={toast.message}
          icon={toast.icon}
          duration={toast.duration}
          onDismiss={() => onRemoveToast?.(toast.id || index)}
          style={{ zIndex: 1000 + index }}
        />
      ))}
    </View>
  );
};

const styles = (theme, config = {}) => StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: theme.spacing.md,
    right: theme.spacing.md,
    backgroundColor: config.backgroundColor || theme.colors.mode.surface,
    borderRadius: theme.borderRadius.lg,
    borderLeftWidth: 4,
    borderLeftColor: config.borderColor || theme.colors.primary[500],
    ...theme.elevation.lg,
    zIndex: 1000,
    overflow: 'hidden',
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 2,
    backgroundColor: config.borderColor || theme.colors.primary[500],
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: config.iconColor + '20' || theme.colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  icon: {
    fontSize: 20,
    color: config.iconColor || theme.colors.primary[500],
  },
  textContent: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  title: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    color: config.textColor || theme.colors.mode.text,
    marginBottom: theme.spacing.xs,
  },
  message: {
    fontSize: theme.typography.sizes.sm,
    color: config.textColor || theme.colors.mode.textSecondary,
    lineHeight: theme.typography.lineHeights.relaxed * theme.typography.sizes.sm,
  },
  dismissButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: theme.colors.mode.border + '40',
  },
  dismissIcon: {
    fontSize: 18,
    color: config.textColor || theme.colors.mode.textSecondary,
    fontWeight: 'bold',
  },
  manager: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    pointerEvents: 'box-none',
  },
});

export default ToastNotification;