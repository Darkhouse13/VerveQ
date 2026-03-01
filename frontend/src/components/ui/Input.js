import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  Animated
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const Input = ({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  success,
  disabled = false,
  multiline = false,
  numberOfLines = 1,
  keyboardType = 'default',
  secureTextEntry = false,
  autoCapitalize = 'none',
  style,
  inputStyle,
  ...props
}) => {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const animatedLabel = useRef(new Animated.Value(value ? 1 : 0)).current;
  const inputRef = useRef(null);

  useEffect(() => {
    Animated.timing(animatedLabel, {
      toValue: isFocused || value ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused, value]);

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  const getContainerStyle = () => {
    return [
      styles(theme).container,
      error && styles(theme).errorContainer,
      success && styles(theme).successContainer,
      disabled && styles(theme).disabledContainer,
      isFocused && styles(theme).focusedContainer,
      style
    ];
  };

  const getInputStyle = () => {
    return [
      styles(theme).input,
      multiline && styles(theme).multilineInput,
      error && styles(theme).errorInput,
      success && styles(theme).successInput,
      disabled && styles(theme).disabledInput,
      inputStyle
    ];
  };

  const labelStyle = {
    ...styles(theme).label,
    top: animatedLabel.interpolate({
      inputRange: [0, 1],
      outputRange: [20, -8],
    }),
    fontSize: animatedLabel.interpolate({
      inputRange: [0, 1],
      outputRange: [theme.typography.sizes.md, theme.typography.sizes.sm],
    }),
    color: error 
      ? theme.colors.error.light
      : success
      ? theme.colors.success.light
      : isFocused
      ? theme.colors.primary[500]
      : theme.colors.mode.textSecondary
  };

  return (
    <View style={getContainerStyle()}>
      {label && (
        <Animated.Text style={labelStyle}>
          {label}
        </Animated.Text>
      )}
      <TextInput
        ref={inputRef}
        style={getInputStyle()}
        placeholder={!isFocused && !value ? placeholder : ''}
        placeholderTextColor={theme.colors.mode.textTertiary}
        value={value}
        onChangeText={onChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        editable={!disabled}
        multiline={multiline}
        numberOfLines={numberOfLines}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        {...props}
      />
      {error && (
        <Text style={styles(theme).errorText}>
          {error}
        </Text>
      )}
      {success && (
        <Text style={styles(theme).successText}>
          {success}
        </Text>
      )}
    </View>
  );
};

const styles = (theme) => StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
    position: 'relative',
  },
  errorContainer: {
    // Container styling for error state handled by input border
  },
  successContainer: {
    // Container styling for success state handled by input border
  },
  disabledContainer: {
    opacity: 0.6,
  },
  focusedContainer: {
    // Container styling for focus state handled by input border
  },
  
  label: {
    position: 'absolute',
    left: theme.spacing.md,
    backgroundColor: theme.colors.mode.background,
    paddingHorizontal: theme.spacing.xs,
    fontWeight: theme.typography.weights.medium,
    zIndex: 1,
  },
  
  input: {
    borderWidth: 2,
    borderColor: theme.colors.mode.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.mode.text,
    backgroundColor: theme.colors.mode.background,
    minHeight: 50,
  },
  multilineInput: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: theme.spacing.md,
  },
  errorInput: {
    borderColor: theme.colors.error.light,
  },
  successInput: {
    borderColor: theme.colors.success.light,
  },
  disabledInput: {
    backgroundColor: theme.colors.neutral[100],
    color: theme.colors.neutral[500],
  },
  
  errorText: {
    color: theme.colors.error.light,
    fontSize: theme.typography.sizes.sm,
    marginTop: theme.spacing.xs,
    marginLeft: theme.spacing.md,
  },
  successText: {
    color: theme.colors.success.light,
    fontSize: theme.typography.sizes.sm,
    marginTop: theme.spacing.xs,
    marginLeft: theme.spacing.md,
  }
});

export default Input;