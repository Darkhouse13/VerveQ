import React, { useState } from 'react';
import {
  TouchableOpacity,
  TouchableHighlight,
  Text,
  View,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import useAccessibility from '../../hooks/useAccessibility';

const AccessibleButton = ({
  children,
  onPress,
  title,
  disabled = false,
  loading = false,
  variant = 'primary',
  size = 'medium',
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  icon,
  iconPosition = 'left',
  testID,
  style,
  textStyle,
  focusable = true,
  ...props
}) => {
  const { theme } = useTheme();
  const {
    createAccessibilityProps,
    getFontSize,
    getMinTouchableSize,
    screenReaderEnabled,
    isHighContrast,
  } = useAccessibility();

  const [isFocused, setIsFocused] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  // Create accessibility properties
  const accessibilityProps = createAccessibilityProps(
    { props: { title, children, accessibilityLabel } },
    {
      role: 'button',
      action: 'press',
      hint: accessibilityHint,
      label: accessibilityLabel || title,
      state: {
        disabled,
        ...accessibilityState,
      },
    }
  );

  // Get button variant styles
  const getVariantStyles = () => {
    const variants = {
      primary: {
        backgroundColor: disabled 
          ? theme.colors.mode.border 
          : theme.colors.primary[500],
        textColor: '#ffffff',
        borderColor: 'transparent',
      },
      secondary: {
        backgroundColor: disabled 
          ? theme.colors.mode.background 
          : theme.colors.mode.surface,
        textColor: disabled 
          ? theme.colors.mode.textDisabled 
          : theme.colors.primary[500],
        borderColor: disabled 
          ? theme.colors.mode.border 
          : theme.colors.primary[500],
      },
      outline: {
        backgroundColor: 'transparent',
        textColor: disabled 
          ? theme.colors.mode.textDisabled 
          : theme.colors.primary[500],
        borderColor: disabled 
          ? theme.colors.mode.border 
          : theme.colors.primary[500],
      },
      ghost: {
        backgroundColor: 'transparent',
        textColor: disabled 
          ? theme.colors.mode.textDisabled 
          : theme.colors.primary[500],
        borderColor: 'transparent',
      },
      destructive: {
        backgroundColor: disabled 
          ? theme.colors.mode.border 
          : theme.colors.error.main,
        textColor: '#ffffff',
        borderColor: 'transparent',
      },
    };

    return variants[variant] || variants.primary;
  };

  // Get size styles
  const getSizeStyles = () => {
    const minTouchable = getMinTouchableSize();
    const sizes = {
      small: {
        paddingHorizontal: Math.max(theme.spacing.md, minTouchable.paddingHorizontal),
        paddingVertical: Math.max(theme.spacing.sm, minTouchable.paddingVertical),
        fontSize: getFontSize(theme.typography.sizes.sm),
        minHeight: minTouchable.minHeight,
      },
      medium: {
        paddingHorizontal: Math.max(theme.spacing.lg, minTouchable.paddingHorizontal),
        paddingVertical: Math.max(theme.spacing.md, minTouchable.paddingVertical),
        fontSize: getFontSize(theme.typography.sizes.md),
        minHeight: Math.max(48, minTouchable.minHeight),
      },
      large: {
        paddingHorizontal: Math.max(theme.spacing.xl, minTouchable.paddingHorizontal),
        paddingVertical: Math.max(theme.spacing.lg, minTouchable.paddingVertical),
        fontSize: getFontSize(theme.typography.sizes.lg),
        minHeight: Math.max(56, minTouchable.minHeight),
      },
    };

    return sizes[size] || sizes.medium;
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  // Enhanced focus styles for screen readers and keyboard navigation
  const getFocusStyles = () => {
    if (!isFocused && !isPressed) return {};

    return {
      borderWidth: 2,
      borderColor: theme.colors.primary[400],
      ...theme.elevation.md,
    };
  };

  const buttonStyles = [
    styles(theme).button,
    {
      backgroundColor: variantStyles.backgroundColor,
      borderColor: variantStyles.borderColor,
      borderWidth: variant === 'outline' || variant === 'secondary' ? 1 : 0,
      paddingHorizontal: sizeStyles.paddingHorizontal,
      paddingVertical: sizeStyles.paddingVertical,
      minHeight: sizeStyles.minHeight,
      opacity: disabled ? 0.6 : 1,
    },
    getFocusStyles(),
    style,
  ];

  const textStyles = [
    styles(theme).text,
    {
      color: variantStyles.textColor,
      fontSize: sizeStyles.fontSize,
    },
    textStyle,
  ];

  const renderContent = () => {
    if (loading) {
      return (
        <Text style={textStyles} accessibilityLabel="Loading">
          Loading...
        </Text>
      );
    }

    const textContent = title || (typeof children === 'string' ? children : null);
    
    if (icon && textContent) {
      return (
        <View style={[
          styles(theme).contentWithIcon,
          iconPosition === 'right' && styles(theme).contentIconRight
        ]}>
          {iconPosition === 'left' && (
            <Text style={[styles(theme).icon, { color: variantStyles.textColor }]}>
              {icon}
            </Text>
          )}
          <Text style={textStyles}>{textContent}</Text>
          {iconPosition === 'right' && (
            <Text style={[styles(theme).icon, { color: variantStyles.textColor }]}>
              {icon}
            </Text>
          )}
        </View>
      );
    }

    if (icon && !textContent) {
      return (
        <Text style={[styles(theme).iconOnly, { color: variantStyles.textColor }]}>
          {icon}
        </Text>
      );
    }

    if (textContent) {
      return <Text style={textStyles}>{textContent}</Text>;
    }

    return children;
  };

  const handlePress = (event) => {
    if (disabled || loading) return;
    onPress?.(event);
  };

  const handlePressIn = () => {
    setIsPressed(true);
  };

  const handlePressOut = () => {
    setIsPressed(false);
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  // Use TouchableHighlight for better accessibility feedback
  const TouchableComponent = screenReaderEnabled ? TouchableHighlight : TouchableOpacity;
  
  const touchableProps = screenReaderEnabled ? {
    underlayColor: theme.colors.primary[100],
    activeOpacity: 0.8,
  } : {
    activeOpacity: disabled ? 1 : 0.8,
  };

  return (
    <TouchableComponent
      {...accessibilityProps}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onFocus={handleFocus}
      onBlur={handleBlur}
      disabled={disabled || loading}
      focusable={focusable && !disabled}
      testID={testID}
      style={buttonStyles}
      {...touchableProps}
      {...props}
    >
      {renderContent()}
    </TouchableComponent>
  );
};

// Specialized accessible button variants
export const AccessibleIconButton = ({ icon, ...props }) => (
  <AccessibleButton
    icon={icon}
    size="medium"
    variant="ghost"
    style={{ aspectRatio: 1 }}
    {...props}
  />
);

export const AccessibleFloatingButton = ({ icon, ...props }) => (
  <AccessibleButton
    icon={icon}
    variant="primary"
    style={{
      borderRadius: 28,
      width: 56,
      height: 56,
      justifyContent: 'center',
      alignItems: 'center',
    }}
    {...props}
  />
);

export const AccessibleToggleButton = ({
  active,
  activeIcon,
  inactiveIcon,
  activeLabel,
  inactiveLabel,
  onToggle,
  ...props
}) => (
  <AccessibleButton
    icon={active ? activeIcon : inactiveIcon}
    accessibilityLabel={active ? activeLabel : inactiveLabel}
    accessibilityState={{ selected: active }}
    onPress={onToggle}
    variant={active ? 'primary' : 'outline'}
    {...props}
  />
);

const styles = (theme) => StyleSheet.create({
  button: {
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  text: {
    fontWeight: theme.typography.weights.medium,
    textAlign: 'center',
  },
  contentWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contentIconRight: {
    flexDirection: 'row-reverse',
  },
  icon: {
    fontSize: 16,
    marginHorizontal: theme.spacing.sm,
  },
  iconOnly: {
    fontSize: 20,
  },
});

export default AccessibleButton;