/**
 * VerveQ Design System - Unified Theme
 * Professional, modern design tokens replacing emoji-heavy UI
 * Supports light/dark modes with proper contrast ratios
 */

// Core Color System
export const colors = {
  // Primary Brand Colors - Professional indigo gradient
  primary: {
    50: '#e8eaf6',
    100: '#c5cae9', 
    200: '#9fa8da',
    300: '#7986cb',
    400: '#5c6bc0',
    500: '#1a237e', // Current primary
    600: '#303f9f',
    700: '#3949ab',
    800: '#3f51b5',
    900: '#1a237e'
  },

  // Secondary Accent Colors
  secondary: {
    emerald: '#10b981',
    emeraldDark: '#059669',
    amber: '#f59e0b',
    amberDark: '#d97706',
    coral: '#f97316',
    coralDark: '#ea580c'
  },

  // Semantic Colors
  success: {
    light: '#4caf50',
    dark: '#2e7d32',
    background: '#e8f5e8'
  },
  warning: {
    light: '#ff9800',
    dark: '#ef6c00',
    background: '#fff3e0'
  },
  error: {
    light: '#f44336',
    dark: '#c62828',
    background: '#ffebee'
  },
  info: {
    light: '#2196f3',
    dark: '#1565c0',
    background: '#e3f2fd'
  },

  // Neutral Colors
  neutral: {
    0: '#ffffff',
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#eeeeee',
    300: '#e0e0e0',
    400: '#bdbdbd',
    500: '#9e9e9e',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121',
    950: '#0a0a0a'
  },

  // Theme-specific colors
  light: {
    background: '#ffffff',
    surface: '#f5f5f5',
    surfaceVariant: '#ffffff',
    text: '#212121',
    textSecondary: '#666666',
    textTertiary: '#9e9e9e',
    border: '#e0e0e0',
    borderLight: '#eeeeee',
    shadow: 'rgba(0, 0, 0, 0.1)'
  },
  dark: {
    background: '#121212',
    surface: '#1e1e1e',
    surfaceVariant: '#2d2d2d',
    text: '#ffffff',
    textSecondary: '#b3b3b3',
    textTertiary: '#666666',
    border: '#404040',
    borderLight: '#2d2d2d',
    shadow: 'rgba(0, 0, 0, 0.3)'
  }
};

// Typography System
export const typography = {
  // Font Sizes
  sizes: {
    xs: 10,
    sm: 12,
    base: 14,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 32,
    '5xl': 48
  },

  // Font Weights
  weights: {
    light: '300',
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700'
  },

  // Line Heights
  lineHeights: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
    loose: 1.8
  },

  // Letter Spacing
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
    wider: 1
  }
};

// Spacing System (8px base)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 40,
  '3xl': 48,
  '4xl': 64
};

// Border Radius
export const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  full: 9999
};

// Elevation/Shadow System
export const elevation = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8
  }
};

// Create theme object
export const createTheme = (isDark = false) => {
  const mode = isDark ? 'dark' : 'light';
  
  return {
    colors: {
      ...colors,
      mode: colors[mode]
    },
    typography,
    spacing,
    borderRadius,
    elevation,
    isDark
  };
};

// Default themes
export const lightTheme = createTheme(false);
export const darkTheme = createTheme(true);

// Utility functions for styled components
export const getColor = (theme, colorPath) => {
  const keys = colorPath.split('.');
  let result = theme.colors;
  
  for (const key of keys) {
    result = result[key];
    if (result === undefined) break;
  }
  
  return result || theme.colors.primary[500];
};

export const getSpacing = (theme, size) => {
  return theme.spacing[size] || size;
};

// Common style helpers
export const createStyles = (theme) => ({
  // Text styles
  heading1: {
    fontSize: theme.typography.sizes['4xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.mode.text,
    lineHeight: theme.typography.lineHeights.tight
  },
  heading2: {
    fontSize: theme.typography.sizes['3xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.mode.text,
    lineHeight: theme.typography.lineHeights.tight
  },
  heading3: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.mode.text,
    lineHeight: theme.typography.lineHeights.normal
  },
  body: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.regular,
    color: theme.colors.mode.text,
    lineHeight: theme.typography.lineHeights.normal
  },
  caption: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.regular,
    color: theme.colors.mode.textSecondary,
    lineHeight: theme.typography.lineHeights.normal
  },

  // Container styles
  container: {
    backgroundColor: theme.colors.mode.background,
    flex: 1
  },
  surface: {
    backgroundColor: theme.colors.mode.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...theme.elevation.md
  },
  card: {
    backgroundColor: theme.colors.mode.surfaceVariant,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    ...theme.elevation.lg
  }
});