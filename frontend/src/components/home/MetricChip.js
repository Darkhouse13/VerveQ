import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

/**
 * MetricChip - small inline metric (icon + value + label)
 * Props: icon (string/emoji), value (string/number), label (string), color override
 */
const MetricChip = ({ icon, value, label, color }) => {
  const { theme } = useTheme();
  return (
    <View style={styles(theme).container}>
      {icon && <Text style={styles(theme).icon}>{icon}</Text>}
      <Text style={[styles(theme).value, color && { color }]}>{value}</Text>
      <Text style={styles(theme).label}>{label}</Text>
    </View>
  );
};

const styles = (theme) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.mode.surfaceVariant,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.mode.border,
    gap: theme.spacing.xs,
  },
  icon: {
    fontSize: theme.typography.sizes.md,
  },
  value: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.mode.text,
  },
  label: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.mode.textSecondary,
    marginLeft: theme.spacing.xs,
  },
});

export default React.memo(MetricChip);
