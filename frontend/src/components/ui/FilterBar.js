import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView,
  Animated,
  Dimensions 
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const { width } = Dimensions.get('window');

const FilterBar = ({
  filters,
  activeFilter,
  onFilterChange,
  showGlobalToggle = false,
  isGlobal = false,
  onGlobalToggle,
  style,
  ...props
}) => {
  const { theme } = useTheme();
  const [slideAnim] = useState(new Animated.Value(0));
  const scrollViewRef = useRef(null);

  const sportIcons = {
    football: '⚽',
    tennis: '🎾',
    basketball: '🏀',
  };

  const modeIcons = {
    quiz: '🧠',
    survival: '⚡',
  };

  const periodIcons = {
    all_time: '🏆',
    monthly: '📅',
    weekly: '📊',
    daily: '📈',
  };

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, []);

  const getFilterIcon = (filterType, value) => {
    switch (filterType) {
      case 'sport':
        return sportIcons[value] || '🏃';
      case 'mode':
        return modeIcons[value] || '🎯';
      case 'period':
        return periodIcons[value] || '⏰';
      default:
        return null;
    }
  };

  const formatFilterLabel = (value, type) => {
    if (type === 'period') {
      const labels = {
        all_time: 'All Time',
        monthly: 'This Month',
        weekly: 'This Week',
        daily: 'Today',
      };
      return labels[value] || value;
    }
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  const renderFilterGroup = (filterGroup) => {
    const { type, options, label } = filterGroup;
    
    return (
      <Animated.View
        key={type}
        style={[
          styles(theme).filterGroup,
          {
            opacity: slideAnim,
            transform: [{
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              })
            }]
          }
        ]}
      >
        <Text style={styles(theme).filterLabel}>{label}:</Text>
        <ScrollView
          ref={type === 'period' ? scrollViewRef : null}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles(theme).filterOptions}
        >
          {options.map((option) => {
            const isActive = activeFilter[type] === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles(theme).filterOption,
                  isActive && styles(theme).filterOptionActive
                ]}
                onPress={() => onFilterChange(type, option.value)}
                activeOpacity={0.7}
              >
                {getFilterIcon(type, option.value) && (
                  <Text style={styles(theme).filterIcon}>
                    {getFilterIcon(type, option.value)}
                  </Text>
                )}
                <Text
                  style={[
                    styles(theme).filterOptionText,
                    isActive && styles(theme).filterOptionTextActive
                  ]}
                >
                  {formatFilterLabel(option.value, type)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Animated.View>
    );
  };

  return (
    <View style={[styles(theme).container, style]} {...props}>
      {/* Global Toggle */}
      {showGlobalToggle && (
        <Animated.View
          style={[
            styles(theme).toggleContainer,
            {
              opacity: slideAnim,
              transform: [{
                translateY: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-10, 0],
                })
              }]
            }
          ]}
        >
          <TouchableOpacity
            style={[
              styles(theme).toggleButton,
              !isGlobal && styles(theme).toggleButtonActive
            ]}
            onPress={() => onGlobalToggle?.(false)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles(theme).toggleText,
                !isGlobal && styles(theme).toggleTextActive
              ]}
            >
              🏆 Sport Specific
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles(theme).toggleButton,
              isGlobal && styles(theme).toggleButtonActive
            ]}
            onPress={() => onGlobalToggle?.(true)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles(theme).toggleText,
                isGlobal && styles(theme).toggleTextActive
              ]}
            >
              🌍 Global Champions
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Filter Groups */}
      {!isGlobal && filters?.map(renderFilterGroup)}
    </View>
  );
};

const styles = (theme) => StyleSheet.create({
  container: {
    backgroundColor: theme.colors.mode.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    ...theme.elevation.sm,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.mode.background,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.xs,
    marginBottom: theme.spacing.lg,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    borderRadius: theme.borderRadius.sm,
  },
  toggleButtonActive: {
    backgroundColor: theme.colors.primary[500],
    ...theme.elevation.xs,
  },
  toggleText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.mode.textSecondary,
  },
  toggleTextActive: {
    color: theme.colors.onPrimary,
  },
  filterGroup: {
    marginBottom: theme.spacing.lg,
  },
  filterLabel: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.mode.text,
    marginBottom: theme.spacing.md,
  },
  filterOptions: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.xs,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.mode.background,
    borderWidth: 1,
    borderColor: theme.colors.mode.border,
    marginRight: theme.spacing.sm,
    minWidth: 60,
    justifyContent: 'center',
  },
  filterOptionActive: {
    backgroundColor: theme.colors.primary[500],
    borderColor: theme.colors.primary[500],
    ...theme.elevation.xs,
  },
  filterIcon: {
    fontSize: theme.typography.sizes.sm,
    marginRight: theme.spacing.xs,
  },
  filterOptionText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.mode.text,
  },
  filterOptionTextActive: {
    color: theme.colors.onPrimary,
    fontWeight: theme.typography.weights.bold,
  },
});

export default FilterBar;
