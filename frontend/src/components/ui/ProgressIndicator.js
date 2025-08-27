import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const ProgressIndicator = ({
  currentStep = 0,
  totalSteps = 3,
  style,
  activeColor,
  inactiveColor,
  size = 'medium'
}) => {
  const { theme } = useTheme();

  const getStepStyle = (index) => {
    const isActive = index <= currentStep;
    const isCompleted = index < currentStep;
    
    return [
      styles(theme).step,
      styles(theme)[`${size}Step`],
      {
        backgroundColor: isActive 
          ? activeColor || theme.colors.primary[500]
          : inactiveColor || theme.colors.mode.border,
        opacity: isCompleted ? 1 : isActive ? 0.8 : 0.3,
      }
    ];
  };

  const getConnectorStyle = (index) => {
    const isActive = index < currentStep;
    
    return [
      styles(theme).connector,
      styles(theme)[`${size}Connector`],
      {
        backgroundColor: isActive 
          ? activeColor || theme.colors.primary[500]
          : inactiveColor || theme.colors.mode.border,
      }
    ];
  };

  return (
    <View style={[styles(theme).container, style]}>
      {Array.from({ length: totalSteps }, (_, index) => (
        <React.Fragment key={index}>
          <View style={getStepStyle(index)} />
          {index < totalSteps - 1 && (
            <View style={getConnectorStyle(index)} />
          )}
        </React.Fragment>
      ))}
    </View>
  );
};

const styles = (theme) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  step: {
    borderRadius: theme.borderRadius.full,
  },
  smallStep: {
    width: 8,
    height: 8,
  },
  mediumStep: {
    width: 12,
    height: 12,
  },
  largeStep: {
    width: 16,
    height: 16,
  },
  connector: {
    height: 2,
  },
  smallConnector: {
    width: theme.spacing.md,
  },
  mediumConnector: {
    width: theme.spacing.lg,
  },
  largeConnector: {
    width: theme.spacing.xl,
  },
});

export default ProgressIndicator;