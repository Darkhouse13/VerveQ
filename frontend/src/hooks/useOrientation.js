import { useState, useEffect, useCallback } from 'react';
import { Dimensions } from 'react-native';

const useOrientation = () => {
  const [screenData, setScreenData] = useState(() => Dimensions.get('screen'));
  const [windowData, setWindowData] = useState(() => Dimensions.get('window'));

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window, screen }) => {
      setWindowData(window);
      setScreenData(screen);
    });

    return () => subscription?.remove();
  }, []);

  // Get current orientation
  const getOrientation = useCallback(() => {
    const { width, height } = windowData;
    return width > height ? 'landscape' : 'portrait';
  }, [windowData]);

  // Get orientation with more detail
  const getDetailedOrientation = useCallback(() => {
    const { width, height } = windowData;
    const orientation = getOrientation();
    
    return {
      orientation,
      isPortrait: orientation === 'portrait',
      isLandscape: orientation === 'landscape',
      aspectRatio: width / height,
      dimensions: { width, height },
    };
  }, [windowData, getOrientation]);

  // Check if device is in a specific orientation
  const isPortrait = getOrientation() === 'portrait';
  const isLandscape = getOrientation() === 'landscape';

  // Get safe layout dimensions for different orientations
  const getLayoutDimensions = useCallback(() => {
    const orientation = getOrientation();
    const { width, height } = windowData;
    
    // Estimate safe areas based on orientation
    // In a real app, you'd use react-native-safe-area-context
    const safeAreaInsets = {
      portrait: {
        top: 44,
        bottom: 34,
        left: 0,
        right: 0,
      },
      landscape: {
        top: 0,
        bottom: 21,
        left: 44,
        right: 44,
      },
    };

    const insets = safeAreaInsets[orientation];
    
    return {
      orientation,
      window: { width, height },
      screen: screenData,
      safeArea: insets,
      usableWidth: width - insets.left - insets.right,
      usableHeight: height - insets.top - insets.bottom,
    };
  }, [windowData, screenData, getOrientation]);

  // Get responsive grid columns based on orientation and device size
  const getResponsiveColumns = useCallback((minColumnWidth = 300, maxColumns = 4) => {
    const { usableWidth } = getLayoutDimensions();
    const orientation = getOrientation();
    
    // Calculate base columns from width
    const baseColumns = Math.floor(usableWidth / minColumnWidth);
    let columns = Math.min(baseColumns, maxColumns);
    
    // Orientation-specific adjustments
    if (orientation === 'portrait') {
      // Portrait mode: prefer fewer columns for better readability
      columns = Math.min(columns, 2);
    } else {
      // Landscape mode: can accommodate more columns
      columns = Math.max(1, columns);
    }
    
    return Math.max(1, columns);
  }, [getLayoutDimensions, getOrientation]);

  // Get orientation-specific spacing
  const getOrientationSpacing = useCallback((baseSpacing = 16) => {
    const orientation = getOrientation();
    const { width } = windowData;
    
    // Adjust spacing based on orientation and screen size
    let horizontalMultiplier = 1;
    let verticalMultiplier = 1;
    
    if (orientation === 'landscape') {
      // Landscape: more horizontal space, less vertical space
      horizontalMultiplier = width > 768 ? 1.5 : 1.2;
      verticalMultiplier = 0.8;
    } else {
      // Portrait: standard spacing or slightly increased for larger screens
      horizontalMultiplier = width > 414 ? 1.1 : 1;
      verticalMultiplier = 1;
    }
    
    return {
      horizontal: Math.round(baseSpacing * horizontalMultiplier),
      vertical: Math.round(baseSpacing * verticalMultiplier),
    };
  }, [getOrientation, windowData]);

  // Get orientation-specific font sizes
  const getOrientationFontSize = useCallback((baseSize, scalingFactor = 1) => {
    const orientation = getOrientation();
    const { width, height } = windowData;
    const minDimension = Math.min(width, height);
    
    // Base scaling from screen size
    let sizeMultiplier = Math.min(1.2, Math.max(0.8, minDimension / 375));
    
    // Orientation-specific adjustments
    if (orientation === 'landscape') {
      // Landscape: slightly smaller text for more content
      sizeMultiplier *= 0.95;
    }
    
    return Math.round(baseSize * sizeMultiplier * scalingFactor);
  }, [getOrientation, windowData]);

  // Check if orientation change should trigger layout recalculation
  const shouldRecalculateLayout = useCallback((prevOrientation) => {
    const currentOrientation = getOrientation();
    return prevOrientation !== currentOrientation;
  }, [getOrientation]);

  // Get animation configuration for orientation changes
  const getOrientationAnimation = useCallback((animationType = 'timing') => {
    const baseConfig = {
      timing: {
        duration: 300,
        useNativeDriver: false, // Layout changes need non-native driver
      },
      spring: {
        tension: 100,
        friction: 8,
        useNativeDriver: false,
      },
    };

    return baseConfig[animationType] || baseConfig.timing;
  }, []);

  // Get content width constraints for different orientations
  const getContentConstraints = useCallback((maxWidth = 800) => {
    const { usableWidth } = getLayoutDimensions();
    const orientation = getOrientation();
    
    if (orientation === 'landscape' && usableWidth > 768) {
      // Landscape on tablet: constrain content width for readability
      return Math.min(usableWidth * 0.7, maxWidth);
    }
    
    // Portrait or smaller screens: use most of available width
    return Math.min(usableWidth, maxWidth);
  }, [getLayoutDimensions, getOrientation]);

  // Detect device rotation capability
  const getRotationCapability = useCallback(() => {
    const { width, height } = screenData;
    const aspectRatio = width / height;
    
    // Most phones and tablets can rotate, but some devices are fixed
    // This is a simplified check
    return {
      canRotate: aspectRatio > 0.5 && aspectRatio < 2,
      preferredOrientation: aspectRatio > 1 ? 'landscape' : 'portrait',
      aspectRatio,
    };
  }, [screenData]);

  return {
    // Current state
    orientation: getOrientation(),
    isPortrait,
    isLandscape,
    dimensions: windowData,
    
    // Detailed information
    ...getDetailedOrientation(),
    
    // Layout calculations
    getLayoutDimensions,
    getResponsiveColumns,
    getContentConstraints,
    
    // Responsive values
    getOrientationSpacing,
    getOrientationFontSize,
    
    // Utilities
    shouldRecalculateLayout,
    getOrientationAnimation,
    getRotationCapability,
    
    // Raw data
    window: windowData,
    screen: screenData,
  };
};

export default useOrientation;