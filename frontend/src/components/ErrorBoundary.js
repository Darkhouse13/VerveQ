import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { safeNavigate, resetNavigationStack } from '../utils/navigationUtils';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      const { theme } = this.props;
      return (
        <View style={styles(theme).container}>
          <View style={styles(theme).errorContainer}>
            <Text style={styles(theme).title}>Something went wrong</Text>
            <Text style={styles(theme).subtitle}>
              The app encountered an unexpected error
            </Text>
            
            {__DEV__ && this.state.error && (
              <View style={styles(theme).debugContainer}>
                <Text style={styles(theme).debugTitle}>Debug Information:</Text>
                <Text style={styles(theme).debugText}>
                  {this.state.error.toString()}
                </Text>
                {this.state.errorInfo && (
                  <Text style={styles(theme).debugText}>
                    {this.state.errorInfo.componentStack}
                  </Text>
                )}
              </View>
            )}
            
            <TouchableOpacity style={styles(theme).resetButton} onPress={this.handleReset}>
              <Text style={styles(theme).resetButtonText}>Try Again</Text>
            </TouchableOpacity>
            
            {this.props.navigation && (
              <TouchableOpacity 
                style={styles(theme).homeButton} 
                onPress={() => {
                  this.handleReset();
                  if (!safeNavigate(this.props.navigation, 'Home')) {
                    resetNavigationStack(this.props.navigation, 'Home');
                  }
                }}
              >
                <Text style={styles(theme).homeButtonText}>Go to Home</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.mode.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorContainer: {
    backgroundColor: theme.colors.mode.surface,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    ...theme.elevation.sm,
    borderWidth: 1,
    borderColor: theme.colors.mode.border,
    maxWidth: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.mode.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.mode.textSecondary,
    marginBottom: 20,
    textAlign: 'center',
  },
  debugContainer: {
    backgroundColor: theme.colors.mode.surfaceVariant,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    width: '100%',
    maxHeight: 200,
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.error.dark,
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: theme.colors.mode.textSecondary,
    fontFamily: 'monospace',
  },
  resetButton: {
    backgroundColor: theme.colors.primary[500],
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  resetButtonText: {
    color: theme.colors.onPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  homeButton: {
    backgroundColor: theme.colors.success.dark,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  homeButtonText: {
    color: theme.colors.onPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

// Functional wrapper to inject theme into the class component
const ThemedErrorBoundary = (props) => {
  const { theme } = useTheme();
  return <ErrorBoundary {...props} theme={theme} />;
};

export default ThemedErrorBoundary;
