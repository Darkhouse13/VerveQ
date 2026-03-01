import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import useDynamicSizing from '../../hooks/useDynamicSizing';
import useOrientation from '../../hooks/useOrientation';

const ResponsiveGrid = ({
  data = [],
  renderItem,
  numColumns,
  minItemWidth = 250,
  maxItemWidth = 400,
  spacing = 16,
  horizontalSpacing,
  verticalSpacing,
  contentContainerStyle,
  style,
  scrollEnabled = true,
  showsVerticalScrollIndicator = false,
  animated = true,
  staggerAnimationDelay = 100,
  keyExtractor,
  onLayout,
  ...props
}) => {
  const { theme } = useTheme();
  const { getResponsiveColumns, deviceType, isTablet } = useDynamicSizing();
  const { getLayoutDimensions, getOrientationSpacing, orientation } = useOrientation();

  const [animatedValues, setAnimatedValues] = useState([]);
  const [layoutCalculated, setLayoutCalculated] = useState(false);

  // Calculate responsive columns
  const calculateColumns = () => {
    if (numColumns) return numColumns;
    
    const { usableWidth } = getLayoutDimensions();
    const orientationSpacing = getOrientationSpacing(spacing);
    const availableWidth = usableWidth - (orientationSpacing.horizontal * 2);
    
    return getResponsiveColumns(minItemWidth);
  };

  const columns = calculateColumns();
  const finalHorizontalSpacing = horizontalSpacing ?? getOrientationSpacing(spacing).horizontal;
  const finalVerticalSpacing = verticalSpacing ?? getOrientationSpacing(spacing).vertical;

  // Initialize animations
  useEffect(() => {
    if (animated && data.length > 0) {
      const animations = data.map(() => new Animated.Value(0));
      setAnimatedValues(animations);
      
      // Stagger the entrance animations
      const animationSequence = animations.map((anim, index) =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 600,
          delay: index * staggerAnimationDelay,
          useNativeDriver: true,
        })
      );

      Animated.stagger(50, animationSequence).start();
    }
  }, [data.length, animated, staggerAnimationDelay]);

  // Calculate item dimensions
  const getItemDimensions = () => {
    const { usableWidth } = getLayoutDimensions();
    const totalHorizontalSpacing = finalHorizontalSpacing * (columns + 1);
    const availableWidth = usableWidth - totalHorizontalSpacing;
    const itemWidth = Math.floor(availableWidth / columns);
    
    // Constrain item width
    const constrainedWidth = Math.min(Math.max(itemWidth, minItemWidth), maxItemWidth);
    
    return {
      width: constrainedWidth,
      spacing: finalHorizontalSpacing,
    };
  };

  // Group data into rows
  const createRows = () => {
    const rows = [];
    for (let i = 0; i < data.length; i += columns) {
      rows.push(data.slice(i, i + columns));
    }
    return rows;
  };

  // Render individual item with animation
  const renderGridItem = (item, index) => {
    const itemKey = keyExtractor ? keyExtractor(item, index) : index;
    const animValue = animatedValues[index];
    
    const animatedStyle = animated && animValue ? {
      opacity: animValue,
      transform: [{
        translateY: animValue.interpolate({
          inputRange: [0, 1],
          outputRange: [20, 0],
        }),
      }],
    } : {};

    return (
      <Animated.View
        key={itemKey}
        style={[
          styles(theme).gridItem,
          {
            width: getItemDimensions().width,
            marginBottom: finalVerticalSpacing,
          },
          animatedStyle,
        ]}
      >
        {renderItem(item, index)}
      </Animated.View>
    );
  };

  // Render grid row
  const renderGridRow = (rowData, rowIndex) => {
    return (
      <View key={rowIndex} style={styles(theme).gridRow}>
        {rowData.map((item, itemIndex) => {
          const globalIndex = rowIndex * columns + itemIndex;
          return (
            <View key={globalIndex} style={styles(theme).gridItemWrapper}>
              {renderGridItem(item, globalIndex)}
              {itemIndex < rowData.length - 1 && (
                <View style={{ width: finalHorizontalSpacing }} />
              )}
            </View>
          );
        })}
        
        {/* Fill empty slots in partial rows */}
        {rowData.length < columns && Array.from({ length: columns - rowData.length }, (_, index) => (
          <View
            key={`empty-${index}`}
            style={[
              styles(theme).gridItemWrapper,
              { width: getItemDimensions().width },
            ]}
          />
        ))}
      </View>
    );
  };

  const rows = createRows();

  const handleLayout = (event) => {
    setLayoutCalculated(true);
    onLayout?.(event);
  };

  const containerStyles = [
    styles(theme).container,
    {
      paddingHorizontal: finalHorizontalSpacing,
      paddingVertical: finalVerticalSpacing,
    },
    contentContainerStyle,
  ];

  if (scrollEnabled) {
    return (
      <ScrollView
        style={[styles(theme).scrollContainer, style]}
        contentContainerStyle={containerStyles}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        onLayout={handleLayout}
        {...props}
      >
        {rows.map((rowData, rowIndex) => renderGridRow(rowData, rowIndex))}
      </ScrollView>
    );
  }

  return (
    <View
      style={[styles(theme).container, containerStyles, style]}
      onLayout={handleLayout}
      {...props}
    >
      {rows.map((rowData, rowIndex) => renderGridRow(rowData, rowIndex))}
    </View>
  );
};

// Specialized grid components
export const LeaderboardGrid = ({ users, onUserPress, ...props }) => (
  <ResponsiveGrid
    data={users}
    renderItem={(user, index) => (
      <LeaderboardCard
        user={user}
        rank={index + 1}
        onPress={() => onUserPress?.(user)}
      />
    )}
    minItemWidth={280}
    maxItemWidth={350}
    keyExtractor={(user) => user.id}
    {...props}
  />
);

export const AchievementGrid = ({ achievements, onAchievementPress, ...props }) => (
  <ResponsiveGrid
    data={achievements}
    renderItem={(achievement, index) => (
      <AchievementCard
        achievement={achievement}
        onPress={() => onAchievementPress?.(achievement)}
      />
    )}
    minItemWidth={200}
    maxItemWidth={300}
    keyExtractor={(achievement) => achievement.id}
    {...props}
  />
);

export const ChallengeGrid = ({ challenges, onChallengeAction, ...props }) => (
  <ResponsiveGrid
    data={challenges}
    renderItem={(challenge, index) => (
      <ChallengeCard
        challenge={challenge}
        onAccept={() => onChallengeAction?.('accept', challenge)}
        onDecline={() => onChallengeAction?.('decline', challenge)}
      />
    )}
    minItemWidth={300}
    maxItemWidth={400}
    keyExtractor={(challenge) => challenge.id}
    {...props}
  />
);

// Masonry-style grid for varied content heights
export const MasonryGrid = ({
  data,
  renderItem,
  columnCount,
  spacing = 16,
  ...props
}) => {
  const { getResponsiveColumns } = useDynamicSizing();
  const columns = columnCount || getResponsiveColumns(200);
  
  // Distribute items across columns for masonry layout
  const distributeItems = () => {
    const columnArrays = Array.from({ length: columns }, () => []);
    
    data.forEach((item, index) => {
      const targetColumn = index % columns;
      columnArrays[targetColumn].push({ item, index });
    });
    
    return columnArrays;
  };

  const columnArrays = distributeItems();

  return (
    <ScrollView
      style={props.style}
      contentContainerStyle={[
        styles().masonryContainer,
        { paddingHorizontal: spacing },
        props.contentContainerStyle,
      ]}
      {...props}
    >
      {columnArrays.map((columnItems, columnIndex) => (
        <View
          key={columnIndex}
          style={[
            styles().masonryColumn,
            {
              marginRight: columnIndex < columns - 1 ? spacing : 0,
            },
          ]}
        >
          {columnItems.map(({ item, index }) => (
            <View
              key={index}
              style={[styles().masonryItem, { marginBottom: spacing }]}
            >
              {renderItem(item, index)}
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
};

const styles = (theme = {}) => StyleSheet.create({
  scrollContainer: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gridItemWrapper: {
    flex: 1,
  },
  gridItem: {
    flex: 1,
  },
  
  // Masonry styles
  masonryContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  masonryColumn: {
    flex: 1,
  },
  masonryItem: {
    width: '100%',
  },
});

export default ResponsiveGrid;