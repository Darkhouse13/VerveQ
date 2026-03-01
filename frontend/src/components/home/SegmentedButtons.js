import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { haptics } from '../../utils/haptics';

// SegmentedButtons component
// Props: items: [{ key, label, onPress }], activeKey
const SegmentedButtons = ({ items = [], activeKey }) => {
  const { theme } = useTheme();

  const handlePress = useCallback((item) => {
  if (Platform.OS !== 'web') { haptics.impact('Light'); }
    item.onPress && item.onPress();
  }, []);

  return (
    <View style={styles(theme).container}>
      {items.map((item, idx) => {
        const active = item.key === activeKey;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            android_ripple={{ color: theme.colors.primary[200] }}
            style={[styles(theme).segment, active && styles(theme).segmentActive, idx === 0 && styles(theme).first, idx === items.length - 1 && styles(theme).last]}
            onPress={() => handlePress(item)}
          >
            <Text style={[styles(theme).label, active && styles(theme).labelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = (theme) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.mode.border,
    backgroundColor: theme.colors.mode.surfaceVariant,
  },
  segment: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: theme.colors.primary[500],
  },
  label: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.mode.textSecondary,
    letterSpacing: 0.5,
  },
  labelActive: {
    color: theme.colors.onPrimary,
  },
  first: {
    borderTopLeftRadius: theme.borderRadius.xl,
    borderBottomLeftRadius: theme.borderRadius.xl,
  },
  last: {
    borderTopRightRadius: theme.borderRadius.xl,
    borderBottomRightRadius: theme.borderRadius.xl,
  }
});

export default React.memo(SegmentedButtons);
