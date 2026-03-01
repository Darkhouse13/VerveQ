import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Dimensions,
  ScrollView,
  Animated
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const { width } = Dimensions.get('window');

const StatsChart = ({
  data = [],
  type = 'line', // 'line', 'bar', 'timeline'
  title,
  subtitle,
  showLegend = true,
  animated = true,
  style,
  ...props
}) => {
  const { theme } = useTheme();
  const [animatedValues] = useState(
    data.map(() => new Animated.Value(animated ? 0 : 1))
  );

  const chartWidth = width - (theme.spacing.lg * 4);
  const chartHeight = 200;

  useEffect(() => {
    if (animated && data.length > 0) {
      const animations = animatedValues.map((anim, index) =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 800 + (index * 100),
          useNativeDriver: false,
        })
      );

      Animated.stagger(50, animations).start();
    }
  }, [data, animated]);

  const getMaxValue = () => {
    return Math.max(...data.map(item => item.value || 0), 1);
  };

  const getColor = (index, item) => {
    if (item.color) return item.color;
    
    const colors = [
      theme.colors.primary[500],
      theme.colors.secondary.emerald,
      theme.colors.secondary.coral,
      theme.colors.secondary.amber,
      theme.colors.secondary.violet,
    ];
    return colors[index % colors.length];
  };

  const renderLineChart = () => {
    if (data.length === 0) return null;

    const maxValue = getMaxValue();
    const pointWidth = chartWidth / Math.max(data.length - 1, 1);

    return (
      <View style={styles(theme).chartContainer}>
        <View style={styles(theme).yAxis}>
          <Text style={styles(theme).axisLabel}>{maxValue}</Text>
          <Text style={styles(theme).axisLabel}>{Math.round(maxValue / 2)}</Text>
          <Text style={styles(theme).axisLabel}>0</Text>
        </View>
        
        <View style={styles(theme).chartArea}>
          {/* Grid Lines */}
          <View style={styles(theme).gridLines}>
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => (
              <View
                key={index}
                style={[
                  styles(theme).gridLine,
                  { top: chartHeight * ratio }
                ]}
              />
            ))}
          </View>

          {/* Data Points */}
          {data.map((item, index) => {
            const x = index * pointWidth;
            const y = chartHeight - ((item.value / maxValue) * chartHeight);
            
            return (
              <Animated.View
                key={index}
                style={[
                  styles(theme).dataPoint,
                  {
                    left: x - 4,
                    top: y - 4,
                    backgroundColor: getColor(index, item),
                    transform: [{
                      scale: animatedValues[index] || 1
                    }]
                  }
                ]}
              />
            );
          })}

          {/* Line Path */}
          <View style={styles(theme).linePath}>
            {data.slice(0, -1).map((item, index) => {
              const startX = index * pointWidth;
              const endX = (index + 1) * pointWidth;
              const startY = chartHeight - ((item.value / maxValue) * chartHeight);
              const endY = chartHeight - ((data[index + 1].value / maxValue) * chartHeight);
              
              const length = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
              const angle = Math.atan2(endY - startY, endX - startX) * (180 / Math.PI);

              return (
                <Animated.View
                  key={index}
                  style={[
                    styles(theme).lineSegment,
                    {
                      left: startX,
                      top: startY,
                      width: animatedValues[index]?.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, length],
                      }) || length,
                      transform: [{ rotate: `${angle}deg` }],
                      backgroundColor: getColor(0, data[0]),
                    }
                  ]}
                />
              );
            })}
          </View>
        </View>
        
        {/* X-Axis Labels */}
        <View style={styles(theme).xAxis}>
          {data.map((item, index) => (
            <Text
              key={index}
              style={[
                styles(theme).xAxisLabel,
                { left: (index * pointWidth) - 20 }
              ]}
            >
              {item.label}
            </Text>
          ))}
        </View>
      </View>
    );
  };

  const renderBarChart = () => {
    if (data.length === 0) return null;

    const maxValue = getMaxValue();
    const barWidth = (chartWidth / data.length) - theme.spacing.sm;

    return (
      <View style={styles(theme).chartContainer}>
        <View style={styles(theme).yAxis}>
          <Text style={styles(theme).axisLabel}>{maxValue}</Text>
          <Text style={styles(theme).axisLabel}>{Math.round(maxValue / 2)}</Text>
          <Text style={styles(theme).axisLabel}>0</Text>
        </View>
        
        <View style={styles(theme).chartArea}>
          {data.map((item, index) => {
            const barHeight = (item.value / maxValue) * chartHeight;
            const x = (index * (barWidth + theme.spacing.sm));
            
            return (
              <Animated.View
                key={index}
                style={[
                  styles(theme).bar,
                  {
                    left: x,
                    bottom: 0,
                    width: barWidth,
                    height: animatedValues[index]?.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, barHeight],
                    }) || barHeight,
                    backgroundColor: getColor(index, item),
                  }
                ]}
              />
            );
          })}
        </View>
        
        {/* X-Axis Labels */}
        <View style={styles(theme).xAxis}>
          {data.map((item, index) => (
            <Text
              key={index}
              style={[
                styles(theme).xAxisLabel,
                { 
                  left: (index * (barWidth + theme.spacing.sm)) + (barWidth / 2) - 20,
                  width: 40,
                  textAlign: 'center'
                }
              ]}
            >
              {item.label}
            </Text>
          ))}
        </View>
      </View>
    );
  };

  const renderTimeline = () => {
    return (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles(theme).timelineContainer}
      >
        {data.map((item, index) => (
          <Animated.View
            key={index}
            style={[
              styles(theme).timelineItem,
              {
                opacity: animatedValues[index] || 1,
                transform: [{
                  translateY: animatedValues[index]?.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }) || 0
                }]
              }
            ]}
          >
            <View style={[styles(theme).timelineMarker, { backgroundColor: getColor(index, item) }]} />
            <Text style={styles(theme).timelineLabel}>{item.label}</Text>
            <Text style={styles(theme).timelineValue}>{item.value}</Text>
          </Animated.View>
        ))}
      </ScrollView>
    );
  };

  const renderChart = () => {
    switch (type) {
      case 'bar':
        return renderBarChart();
      case 'timeline':
        return renderTimeline();
      case 'line':
      default:
        return renderLineChart();
    }
  };

  return (
    <View style={[styles(theme).container, style]} {...props}>
      {(title || subtitle) && (
        <View style={styles(theme).header}>
          {title && (
            <Text style={styles(theme).title}>{title}</Text>
          )}
          {subtitle && (
            <Text style={styles(theme).subtitle}>{subtitle}</Text>
          )}
        </View>
      )}

      {data.length > 0 ? (
        renderChart()
      ) : (
        <View style={styles(theme).emptyState}>
          <Text style={styles(theme).emptyText}>No data available</Text>
        </View>
      )}

      {showLegend && data.length > 0 && type !== 'timeline' && (
        <View style={styles(theme).legend}>
          {data.slice(0, 3).map((item, index) => (
            <View key={index} style={styles(theme).legendItem}>
              <View style={[styles(theme).legendColor, { backgroundColor: getColor(index, item) }]} />
              <Text style={styles(theme).legendText}>{item.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = (theme) => StyleSheet.create({
  container: {
    backgroundColor: theme.colors.mode.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.elevation.sm,
  },
  header: {
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.mode.text,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.mode.textSecondary,
  },
  chartContainer: {
    flexDirection: 'row',
    height: chartHeight + 40,
  },
  yAxis: {
    width: 40,
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
  },
  axisLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.mode.textSecondary,
    textAlign: 'right',
  },
  chartArea: {
    flex: 1,
    position: 'relative',
    height: chartHeight,
  },
  gridLines: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: chartHeight,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: theme.colors.mode.border,
  },
  dataPoint: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  linePath: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: chartHeight,
  },
  lineSegment: {
    position: 'absolute',
    height: 2,
  },
  bar: {
    position: 'absolute',
    borderRadius: theme.borderRadius.sm,
  },
  xAxis: {
    position: 'absolute',
    bottom: -30,
    left: 40,
    right: 0,
    height: 30,
  },
  xAxisLabel: {
    position: 'absolute',
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.mode.textSecondary,
    width: 40,
  },
  timelineContainer: {
    flexDirection: 'row',
  },
  timelineItem: {
    alignItems: 'center',
    marginRight: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  timelineMarker: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: theme.spacing.sm,
  },
  timelineLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.mode.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  timelineValue: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.mode.text,
  },
  emptyState: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.mode.textSecondary,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: theme.spacing.lg,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: theme.spacing.sm,
  },
  legendText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.mode.textSecondary,
  },
});

const chartHeight = 200;

export default StatsChart;