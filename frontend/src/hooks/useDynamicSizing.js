import { useState, useEffect, useCallback } from 'react';
import { Dimensions, PixelRatio } from 'react-native';
import useAccessibility from './useAccessibility';

const useDynamicSizing = () => {
  const [screenData, setScreenData] = useState(() => Dimensions.get('screen'));
  const [windowData, setWindowData] = useState(() => Dimensions.get('window'));
  const { fontScale } = useAccessibility();

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window, screen }) => {
      setWindowData(window);
      setScreenData(screen);
    });

    return () => subscription?.remove();
  }, []);

  // Device categorization
  const getDeviceType = useCallback(() => {
    const { width, height } = windowData;
    const minDimension = Math.min(width, height);
    const maxDimension = Math.max(width, height);

    if (minDimension >= 768) {
      return 'tablet';
    } else if (minDimension >= 414) {
      return 'large-phone';
    } else if (minDimension >= 375) {
      return 'medium-phone';
    } else {
      return 'small-phone';
    }
  }, [windowData]);

  // Orientation detection
  const getOrientation = useCallback(() => {
    const { width, height } = windowData;
    return width > height ? 'landscape' : 'portrait';
  }, [windowData]);

  // Breakpoint system
  const getBreakpoint = useCallback(() => {
    const { width } = windowData;
    
    if (width >= 1200) return 'xl';
    if (width >= 992) return 'lg';
    if (width >= 768) return 'md';
    if (width >= 576) return 'sm';
    return 'xs';
  }, [windowData]);

  // Responsive font sizing
  const getResponsiveFontSize = useCallback((baseSize, scaleFactor = 1) => {
    const { width } = windowData;
    const deviceType = getDeviceType();
    
    // Base scaling factors by device type
    const deviceScaling = {
      'small-phone': 0.9,
      'medium-phone': 1,
      'large-phone': 1.1,
      'tablet': 1.2,
    };

    // Screen width scaling (subtle)
    const widthScale = Math.min(1.2, Math.max(0.8, width / 375));
    
    const deviceScale = deviceScaling[deviceType] || 1;
    const finalScale = deviceScale * widthScale * scaleFactor * fontScale;
    
    return Math.round(baseSize * finalScale);
  }, [windowData, getDeviceType, fontScale]);

  // Responsive spacing
  const getResponsiveSpacing = useCallback((baseSpacing) => {
    const deviceType = getDeviceType();
    
    const spacingMultipliers = {
      'small-phone': 0.8,
      'medium-phone': 1,
      'large-phone': 1.1,
      'tablet': 1.3,
    };

    const multiplier = spacingMultipliers[deviceType] || 1;
    return Math.round(baseSpacing * multiplier);
  }, [getDeviceType]);

  // Grid columns calculation
  const getGridColumns = useCallback((minColumnWidth = 300) => {
    const { width } = windowData;
    const availableWidth = width - 32; // Account for margins
    return Math.max(1, Math.floor(availableWidth / minColumnWidth));
  }, [windowData]);

  // Safe area calculations (simplified)
  const getSafeAreaInsets = useCallback(() => {
    const deviceType = getDeviceType();
    const orientation = getOrientation();
    
    // Simplified safe area insets based on device type
    // In a real app, you'd use react-native-safe-area-context
    const baseInsets = {
      top: deviceType === 'tablet' ? 20 : 44,
      bottom: deviceType === 'tablet' ? 20 : 34,
      left: 0,
      right: 0,
    };

    // Adjust for landscape mode
    if (orientation === 'landscape') {
      baseInsets.top = 0;
      baseInsets.bottom = 21;
      baseInsets.left = deviceType === 'tablet' ? 20 : 44;
      baseInsets.right = deviceType === 'tablet' ? 20 : 44;
    }

    return baseInsets;
  }, [getDeviceType, getOrientation]);

  // Layout dimensions
  const getLayoutDimensions = useCallback(() => {
    const safeArea = getSafeAreaInsets();
    const { width, height } = windowData;
    
    return {
      window: windowData,
      screen: screenData,
      safeArea,
      usableWidth: width - safeArea.left - safeArea.right,
      usableHeight: height - safeArea.top - safeArea.bottom,
    };
  }, [windowData, screenData, getSafeAreaInsets]);

  // Responsive styles generator
  const createResponsiveStyles = useCallback((styleConfig) => {
    const breakpoint = getBreakpoint();
    const deviceType = getDeviceType();
    const orientation = getOrientation();
    
    let styles = { ...styleConfig.base };
    
    // Apply breakpoint-specific styles
    if (styleConfig.breakpoints?.[breakpoint]) {
      styles = { ...styles, ...styleConfig.breakpoints[breakpoint] };
    }
    
    // Apply device-specific styles
    if (styleConfig.devices?.[deviceType]) {
      styles = { ...styles, ...styleConfig.devices[deviceType] };
    }
    
    // Apply orientation-specific styles
    if (styleConfig.orientations?.[orientation]) {
      styles = { ...styles, ...styleConfig.orientations[orientation] };
    }

    return styles;
  }, [getBreakpoint, getDeviceType, getOrientation]);

  // Touch target sizing
  const getTouchableSize = useCallback((baseSize = 44) => {
    const deviceType = getDeviceType();
    const pixelDensity = PixelRatio.get();
    
    // Ensure minimum touch target size
    const minSize = 44;
    const scaledSize = baseSize * (deviceType === 'tablet' ? 1.2 : 1);
    
    // Adjust for pixel density
    const densityAdjustedSize = scaledSize + (pixelDensity > 2 ? 4 : 0);
    
    return Math.max(minSize, densityAdjustedSize);
  }, [getDeviceType]);

  // Container width for content
  const getContentWidth = useCallback((maxWidth = 800) => {
    const { width } = windowData;
    const deviceType = getDeviceType();
    
    if (deviceType === 'tablet') {
      return Math.min(width * 0.8, maxWidth);
    }
    
    return width - 32; // Standard phone margins
  }, [windowData, getDeviceType]);

  // Responsive margin/padding
  const getResponsiveEdgeInsets = useCallback((base = 16) => {
    const deviceType = getDeviceType();
    const orientation = getOrientation();
    
    const multipliers = {
      'small-phone': { horizontal: 1, vertical: 0.8 },
      'medium-phone': { horizontal: 1, vertical: 1 },
      'large-phone': { horizontal: 1.2, vertical: 1.1 },
      'tablet': { horizontal: 2, vertical: 1.5 },
    };
    
    const multiplier = multipliers[deviceType] || multipliers['medium-phone'];
    
    // Adjust for landscape
    if (orientation === 'landscape' && deviceType !== 'tablet') {
      multiplier.horizontal *= 1.5;
      multiplier.vertical *= 0.8;
    }
    
    return {
      horizontal: Math.round(base * multiplier.horizontal),
      vertical: Math.round(base * multiplier.vertical),
    };
  }, [getDeviceType, getOrientation]);

  return {
    // Screen data
    window: windowData,
    screen: screenData,
    
    // Device information
    deviceType: getDeviceType(),
    orientation: getOrientation(),
    breakpoint: getBreakpoint(),
    isTablet: getDeviceType() === 'tablet',
    isLandscape: getOrientation() === 'landscape',
    
    // Sizing functions
    getResponsiveFontSize,
    getResponsiveSpacing,
    getTouchableSize,
    getContentWidth,
    getResponsiveEdgeInsets,
    
    // Layout functions
    getGridColumns,
    getSafeAreaInsets,
    getLayoutDimensions,
    createResponsiveStyles,
    
    // Utilities
    pixelRatio: PixelRatio.get(),
    fontScale,
  };
};

export default useDynamicSizing;