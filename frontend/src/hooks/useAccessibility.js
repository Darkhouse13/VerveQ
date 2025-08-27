import { useState, useEffect, useCallback } from 'react';
import { AccessibilityInfo, Appearance, PixelRatio } from 'react-native';

const useAccessibility = () => {
  const [screenReaderEnabled, setScreenReaderEnabled] = useState(false);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const [highContrastEnabled, setHighContrastEnabled] = useState(false);
  const [fontScale, setFontScale] = useState(PixelRatio.getFontScale?.() || 1);
  const [colorScheme, setColorScheme] = useState('light');

  useEffect(() => {
    // Initialize accessibility settings
    const initializeAccessibility = async () => {
      try {
        // Check if screen reader is enabled
        const screenReader = await AccessibilityInfo.isScreenReaderEnabled();
        setScreenReaderEnabled(screenReader);

        // Check if reduce motion is enabled
        const reduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
        setReduceMotionEnabled(reduceMotion);

        // Proper font scale (RN 0.73+). Fallback to PixelRatio if not supported.
        try {
          if (AccessibilityInfo.getFontScale) {
            const scaleVal = await AccessibilityInfo.getFontScale();
            if (scaleVal && typeof scaleVal === 'number') {
              setFontScale(Math.min(Math.max(scaleVal, 0.8), 2));
            }
          }
        } catch (e) {
          setFontScale(PixelRatio.getFontScale?.() || 1);
        }

        // Get color scheme
        const scheme = Appearance.getColorScheme();
        setColorScheme(scheme || 'light');
        
        // High contrast detection (basic heuristic)
        setHighContrastEnabled(scheme === 'dark');
      } catch (error) {
        console.warn('Error initializing accessibility:', error);
      }
    };

    initializeAccessibility();

    // Set up listeners
    const screenReaderListener = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setScreenReaderEnabled
    );

    const reduceMotionListener = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotionEnabled
    );

    const colorSchemeListener = Appearance.addChangeListener(({ colorScheme: scheme }) => {
      setColorScheme(scheme || 'light');
      setHighContrastEnabled(scheme === 'dark');
    });

    return () => {
      screenReaderListener?.remove();
      reduceMotionListener?.remove();
      colorSchemeListener?.remove();
    };
  }, []);

  const announce = useCallback((message, options = {}) => {
    if (!screenReaderEnabled) return;

    const { priority = 'polite', delay = 0 } = options;
    
    const announceMessage = () => {
      try {
        AccessibilityInfo.announceForAccessibility(message);
      } catch (error) {
        console.warn('Error announcing message:', error);
      }
    };

    if (delay > 0) {
      setTimeout(announceMessage, delay);
    } else {
      announceMessage();
    }
  }, [screenReaderEnabled]);

  const getAccessibleLabel = useCallback((element, context = '') => {
    if (!element) return '';

    const { title, children, accessibilityLabel } = element.props || {};
    
    if (accessibilityLabel) return accessibilityLabel;
    if (title) return `${context} ${title}`.trim();
    if (typeof children === 'string') return `${context} ${children}`.trim();
    
    return context;
  }, []);

  const getAccessibleHint = useCallback((action, element) => {
    const actionHints = {
      press: 'Double tap to activate',
      swipe: 'Swipe left or right to navigate',
      longPress: 'Press and hold for more options',
      select: 'Double tap to select',
      expand: 'Double tap to expand',
      collapse: 'Double tap to collapse',
    };

    return actionHints[action] || 'Interactive element';
  }, []);

  const createAccessibilityProps = useCallback((element, options = {}) => {
    const {
      role = 'button',
      action = 'press',
      hint,
      label,
      state,
      disabled = false,
    } = options;

    const accessibilityLabel = label || getAccessibleLabel(element);
    const accessibilityHint = hint || getAccessibleHint(action, element);

    const props = {
      accessible: true,
      accessibilityRole: role,
      accessibilityLabel,
      accessibilityHint,
    };

    // Add state information
    if (state) {
      if (state.selected !== undefined) {
        props.accessibilityState = { selected: state.selected };
      }
      if (state.expanded !== undefined) {
        props.accessibilityState = { ...props.accessibilityState, expanded: state.expanded };
      }
      if (state.checked !== undefined) {
        props.accessibilityState = { ...props.accessibilityState, checked: state.checked };
      }
    }

    if (disabled) {
      props.accessibilityState = { ...props.accessibilityState, disabled: true };
    }

    return props;
  }, [getAccessibleLabel, getAccessibleHint]);

  const getAnimationConfig = useCallback((defaultDuration = 300) => {
    return {
      duration: reduceMotionEnabled ? Math.min(defaultDuration * 0.3, 100) : defaultDuration,
      useNativeDriver: true,
    };
  }, [reduceMotionEnabled]);

  const getFontSize = useCallback((baseSize) => {
    return baseSize * fontScale;
  }, [fontScale]);

  const getMinTouchableSize = useCallback(() => {
    // WCAG minimum touch target size is 44x44 points
    const minSize = 44;
    return {
      minWidth: minSize,
      minHeight: minSize,
      paddingHorizontal: Math.max(0, (minSize - 20) / 2), // Adjust for typical text size
      paddingVertical: Math.max(0, (minSize - 20) / 2),
    };
  }, []);

  const getContrastRatio = useCallback((foreground, background) => {
    // Simple contrast ratio calculation
    // In a real app, you'd use a proper color contrast library
    const getLuminance = (color) => {
      // Simplified luminance calculation
      const rgb = parseInt(color.replace('#', ''), 16);
      const r = (rgb >> 16) & 0xff;
      const g = (rgb >> 8) & 0xff;
      const b = rgb & 0xff;
      return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    };

    const fgLum = getLuminance(foreground);
    const bgLum = getLuminance(background);
    
    const lighter = Math.max(fgLum, bgLum);
    const darker = Math.min(fgLum, bgLum);
    
    return (lighter + 0.05) / (darker + 0.05);
  }, []);

  const isHighContrast = useCallback((foreground, background, level = 'AA') => {
    const ratio = getContrastRatio(foreground, background);
    const thresholds = {
      'AA': 4.5,
      'AAA': 7,
      'AA-large': 3,
      'AAA-large': 4.5,
    };
    
    return ratio >= (thresholds[level] || 4.5);
  }, [getContrastRatio]);

  return {
    // State
    screenReaderEnabled,
    reduceMotionEnabled,
    highContrastEnabled,
    fontScale,
    colorScheme,
    
    // Methods
    announce,
    createAccessibilityProps,
    getAnimationConfig,
    getFontSize,
    getMinTouchableSize,
    getContrastRatio,
    isHighContrast,
    
    // Helpers
    isReducedMotion: reduceMotionEnabled,
    isScreenReaderActive: screenReaderEnabled,
    isDarkMode: colorScheme === 'dark',
    isAccessibilityEnabled: screenReaderEnabled || reduceMotionEnabled || fontScale > 1,
  };
};

export default useAccessibility;