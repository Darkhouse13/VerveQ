import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const Card = ({
  children,
  variant = 'default',
  elevation = 'md',
  pressable = false,
  onPress,
  style,
  ...props
}) => {
  const { theme } = useTheme();

  const getCardStyle = () => {
    const baseStyle = styles(theme).card;
    const variantStyle = styles(theme)[`${variant}Card`];
    const elevationStyle = theme.elevation[elevation] || theme.elevation.md;
    
    return [
      baseStyle,
      variantStyle,
      elevationStyle,
      style
    ];
  };

  const CardComponent = pressable ? TouchableOpacity : View;

  return (
    <CardComponent
      style={getCardStyle()}
      onPress={pressable ? onPress : undefined}
      activeOpacity={pressable ? 0.95 : 1}
      {...props}
    >
      {children}
    </CardComponent>
  );
};

const styles = (theme) => StyleSheet.create({
  // Base card style
  card: {
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.mode.surfaceVariant,
  },

  // Card variants
  defaultCard: {
    // Default styling already applied in base
  },
  glassCard: {
    backgroundColor: theme.isDark 
      ? 'rgba(255, 255, 255, 0.05)'
      : 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: theme.isDark 
      ? 'rgba(255, 255, 255, 0.1)'
      : 'rgba(0, 0, 0, 0.05)',
  },
  gradientCard: {
    // Will be enhanced with LinearGradient component later
    backgroundColor: theme.colors.primary[500],
  },
  accentCard: {
    backgroundColor: theme.colors.primary[50],
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary[500],
  }
});

export default Card;