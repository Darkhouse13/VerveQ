import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const Button = ({
  title,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  onPress,
  style,
  textStyle,
  ...props
}) => {
  const { theme } = useTheme();
  const animatedScale = new Animated.Value(1);

  const handlePressIn = () => {
    Animated.spring(animatedScale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(animatedScale, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const getButtonStyle = () => {
    const baseStyle = styles(theme).button;
    const variantStyle = styles(theme)[`${variant}Button`];
    const sizeStyle = styles(theme)[`${size}Button`];
    
    return [
      baseStyle,
      variantStyle,
      sizeStyle,
      disabled && styles(theme).disabledButton,
      style
    ];
  };

  const getTextStyle = () => {
    const baseTextStyle = styles(theme).buttonText;
    const variantTextStyle = styles(theme)[`${variant}ButtonText`];
    const sizeTextStyle = styles(theme)[`${size}ButtonText`];
    
    return [
      baseTextStyle,
      variantTextStyle,
      sizeTextStyle,
      disabled && styles(theme).disabledButtonText,
      textStyle
    ];
  };

  return (
    <Animated.View style={{ transform: [{ scale: animatedScale }] }}>
      <TouchableOpacity
        style={getButtonStyle()}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        activeOpacity={0.8}
        {...props}
      >
        {loading ? (
          <ActivityIndicator 
            size="small" 
            color={variant === 'outline' ? theme.colors.primary[500] : theme.colors.onPrimary} 
          />
        ) : (
          <Text style={getTextStyle()}>{title}</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = (theme) => StyleSheet.create({
  // Base button style
  button: {
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    ...theme.elevation.sm
  },

  // Button variants
  primaryButton: {
    backgroundColor: theme.colors.primary[500],
  },
  secondaryButton: {
    backgroundColor: theme.colors.secondary.emerald,
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: theme.colors.primary[500],
  },

  // Button sizes
  smallButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  mediumButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  largeButton: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
  },

  // Disabled state
  disabledButton: {
    backgroundColor: theme.colors.neutral[300],
    borderColor: theme.colors.neutral[300],
    ...theme.elevation.none
  },

  // Text styles
  buttonText: {
    fontWeight: theme.typography.weights.semibold,
    textAlign: 'center',
  },

  // Text variants
  primaryButtonText: {
    color: theme.colors.onPrimary,
    fontSize: theme.typography.sizes.md,
  },
  secondaryButtonText: {
    color: theme.colors.onPrimary,
    fontSize: theme.typography.sizes.md,
  },
  outlineButtonText: {
    color: theme.colors.primary[500],
    fontSize: theme.typography.sizes.md,
  },

  // Text sizes
  smallButtonText: {
    fontSize: theme.typography.sizes.sm,
  },
  mediumButtonText: {
    fontSize: theme.typography.sizes.md,
  },
  largeButtonText: {
    fontSize: theme.typography.sizes.lg,
  },

  // Disabled text
  disabledButtonText: {
    color: theme.colors.neutral[500],
  }
});

export default Button;
