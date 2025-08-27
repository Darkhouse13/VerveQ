import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import useDynamicSizing from '../../hooks/useDynamicSizing';
import useAccessibility from '../../hooks/useAccessibility';

const DynamicText = ({
  children,
  variant = 'body',
  size,
  weight,
  color,
  align = 'left',
  maxLines,
  adjustsFontSizeToFit = false,
  minimumFontScale = 0.8,
  maxFontSize,
  minFontSize,
  responsive = true,
  accessibilityRole,
  style,
  ...props
}) => {
  const { theme } = useTheme();
  const { getResponsiveFontSize, deviceType, isTablet } = useDynamicSizing();
  const { getFontSize, isHighContrast } = useAccessibility();

  // Text variant configurations
  const getVariantStyles = () => {
    const variants = {
      // Headings
      h1: {
        fontSize: theme.typography.sizes['4xl'],
        fontWeight: theme.typography.weights.bold,
        lineHeight: theme.typography.lineHeights.tight,
        marginBottom: theme.spacing.lg,
      },
      h2: {
        fontSize: theme.typography.sizes['3xl'],
        fontWeight: theme.typography.weights.bold,
        lineHeight: theme.typography.lineHeights.tight,
        marginBottom: theme.spacing.md,
      },
      h3: {
        fontSize: theme.typography.sizes['2xl'],
        fontWeight: theme.typography.weights.bold,
        lineHeight: theme.typography.lineHeights.snug,
        marginBottom: theme.spacing.md,
      },
      h4: {
        fontSize: theme.typography.sizes.xl,
        fontWeight: theme.typography.weights.semibold,
        lineHeight: theme.typography.lineHeights.snug,
        marginBottom: theme.spacing.sm,
      },
      h5: {
        fontSize: theme.typography.sizes.lg,
        fontWeight: theme.typography.weights.semibold,
        lineHeight: theme.typography.lineHeights.normal,
        marginBottom: theme.spacing.sm,
      },
      h6: {
        fontSize: theme.typography.sizes.md,
        fontWeight: theme.typography.weights.semibold,
        lineHeight: theme.typography.lineHeights.normal,
        marginBottom: theme.spacing.xs,
      },
      
      // Body text
      body: {
        fontSize: theme.typography.sizes.md,
        fontWeight: theme.typography.weights.normal,
        lineHeight: theme.typography.lineHeights.relaxed,
      },
      bodyLarge: {
        fontSize: theme.typography.sizes.lg,
        fontWeight: theme.typography.weights.normal,
        lineHeight: theme.typography.lineHeights.relaxed,
      },
      bodySmall: {
        fontSize: theme.typography.sizes.sm,
        fontWeight: theme.typography.weights.normal,
        lineHeight: theme.typography.lineHeights.normal,
      },
      
      // Caption and labels
      caption: {
        fontSize: theme.typography.sizes.sm,
        fontWeight: theme.typography.weights.normal,
        lineHeight: theme.typography.lineHeights.normal,
        color: theme.colors.mode.textSecondary,
      },
      label: {
        fontSize: theme.typography.sizes.sm,
        fontWeight: theme.typography.weights.medium,
        lineHeight: theme.typography.lineHeights.normal,
      },
      overline: {
        fontSize: theme.typography.sizes.xs,
        fontWeight: theme.typography.weights.semibold,
        lineHeight: theme.typography.lineHeights.normal,
        textTransform: 'uppercase',
        letterSpacing: 1,
      },
      
      // UI text
      button: {
        fontSize: theme.typography.sizes.md,
        fontWeight: theme.typography.weights.medium,
        lineHeight: theme.typography.lineHeights.tight,
        textAlign: 'center',
      },
      link: {
        fontSize: theme.typography.sizes.md,
        fontWeight: theme.typography.weights.medium,
        lineHeight: theme.typography.lineHeights.normal,
        color: theme.colors.primary[500],
        textDecorationLine: 'underline',
      },
      
      // Special variants
      display: {
        fontSize: theme.typography.sizes['5xl'],
        fontWeight: theme.typography.weights.bold,
        lineHeight: theme.typography.lineHeights.none,
      },
      mono: {
        fontSize: theme.typography.sizes.sm,
        fontFamily: 'monospace',
        lineHeight: theme.typography.lineHeights.normal,
      },
    };

    return variants[variant] || variants.body;
  };

  const variantStyles = getVariantStyles();
  
  // Calculate responsive font size
  const getCalculatedFontSize = () => {
    let fontSize = size || variantStyles.fontSize;
    if (responsive) {
      fontSize = getResponsiveFontSize(fontSize);
    }
    // Accessibility scaling already applied via PixelRatio in responsive function; avoid double scaling.
    // If we still want a minimal adjustment, allow getFontSize only when fontScale > 1.05 (large text users)
    const scaled = getFontSize(1) > 1.05 ? getFontSize(fontSize) : fontSize;
    fontSize = scaled;
    if (maxFontSize) fontSize = Math.min(fontSize, maxFontSize);
    if (minFontSize) fontSize = Math.max(fontSize, minFontSize);
    // Clamp heading sizes to a readable minimum
    if (/^h[1-6]$/.test(variant) && fontSize < 16) {
      fontSize = 16;
    }
    return fontSize;
  };

  // Calculate line height based on font size
  const getCalculatedLineHeight = () => {
    const fontSize = getCalculatedFontSize();
    const baseLineHeight = variantStyles.lineHeight || theme.typography.lineHeights.normal;
    return Math.round(fontSize * baseLineHeight);
  };

  // Get color with high contrast adjustments
  const getTextColor = () => {
    if (color) return color;
    if (variantStyles.color) return variantStyles.color;
    
    // Default text color with high contrast consideration
    const baseColor = theme.colors.mode.text;
    
    if (isHighContrast) {
      // Ensure better contrast in high contrast mode
      return theme.colors.mode.text;
    }
    
    return baseColor;
  };

  // Text alignment
  const getTextAlign = () => {
    return align;
  };

  // Combine all styles
  const textStyles = [
    styles(theme).base,
    {
      fontSize: getCalculatedFontSize(),
      fontWeight: weight || variantStyles.fontWeight,
      lineHeight: getCalculatedLineHeight(),
      color: getTextColor(),
      textAlign: getTextAlign(),
    },
    // Tablet-specific adjustments
    isTablet && styles(theme).tablet,
    // Variant-specific styles (excluding fontSize, fontWeight, lineHeight, color which we handle above)
    {
      marginBottom: variantStyles.marginBottom,
      textDecorationLine: variantStyles.textDecorationLine,
      textTransform: variantStyles.textTransform,
      letterSpacing: variantStyles.letterSpacing,
      fontFamily: variantStyles.fontFamily,
    },
    style,
  ];

  // Accessibility props
  const accessibilityProps = {
    accessible: true,
    accessibilityRole: accessibilityRole || getAccessibilityRole(),
  };

  function getAccessibilityRole() {
    if (variant.startsWith('h')) return 'header';
    if (variant === 'link') return 'link';
    if (variant === 'button') return 'button';
    return 'text';
  }

  return (
    <Text
      style={textStyles}
      numberOfLines={maxLines}
      adjustsFontSizeToFit={adjustsFontSizeToFit}
      minimumFontScale={minimumFontScale}
      {...accessibilityProps}
      {...props}
    >
      {children}
    </Text>
  );
};

// Convenience components for common variants
export const Heading1 = (props) => <DynamicText variant="h1" {...props} />;
export const Heading2 = (props) => <DynamicText variant="h2" {...props} />;
export const Heading3 = (props) => <DynamicText variant="h3" {...props} />;
export const Heading4 = (props) => <DynamicText variant="h4" {...props} />;
export const Heading5 = (props) => <DynamicText variant="h5" {...props} />;
export const Heading6 = (props) => <DynamicText variant="h6" {...props} />;

export const BodyText = (props) => <DynamicText variant="body" {...props} />;
export const BodyLarge = (props) => <DynamicText variant="bodyLarge" {...props} />;
export const BodySmall = (props) => <DynamicText variant="bodySmall" {...props} />;

export const Caption = (props) => <DynamicText variant="caption" {...props} />;
export const Label = (props) => <DynamicText variant="label" {...props} />;
export const Overline = (props) => <DynamicText variant="overline" {...props} />;

export const ButtonText = (props) => <DynamicText variant="button" {...props} />;
export const LinkText = (props) => <DynamicText variant="link" {...props} />;

export const DisplayText = (props) => <DynamicText variant="display" {...props} />;
export const MonoText = (props) => <DynamicText variant="mono" {...props} />;

// Responsive text with breakpoint-specific sizing
export const ResponsiveText = ({
  breakpoints = {},
  ...props
}) => {
  const { breakpoint } = useDynamicSizing();
  const breakpointSize = breakpoints[breakpoint];
  
  return (
    <DynamicText
      size={breakpointSize}
      responsive={!breakpointSize} // Don't apply responsive scaling if breakpoint size is set
      {...props}
    />
  );
};

const styles = (theme) => StyleSheet.create({
  base: {
    // Base styles that apply to all text
    includeFontPadding: false, // Android: Remove extra padding
    textAlignVertical: 'center', // Android: Align text consistently
  },
  tablet: {
    // Additional styles for tablet devices
    letterSpacing: 0.2,
  },
});

export default DynamicText;