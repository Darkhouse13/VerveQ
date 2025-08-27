import React from 'react';
import { Pressable, Text, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { haptics } from '../../utils/haptics';

/**
 * FilterChip - pill style selectable chip
 * Props: label, selected, onPress
 */
const FilterChip = ({ label, selected, onPress }) => {
  const { theme } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
  if (Platform.OS !== 'web') { haptics.selection(); }
        onPress && onPress();
      }}
      style={[
        styles(theme).chip,
        selected && styles(theme).chipSelected,
      ]}
    >
      <Text style={[styles(theme).label, selected && styles(theme).labelSelected]}>
        {label}
      </Text>
    </Pressable>
  );
};

const styles = (theme) => StyleSheet.create({
  chip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.mode.border,
    marginRight: theme.spacing.sm,
  },
  chipSelected: {
    backgroundColor: theme.colors.primary[500],
    borderColor: theme.colors.primary[500],
  },
  label: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.mode.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  labelSelected: {
    color: '#ffffff',
  },
});

export default React.memo(FilterChip);
