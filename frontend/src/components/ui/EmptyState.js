import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import Button from './Button';

const EmptyState = ({
  type = 'no-data',
  title,
  message,
  illustration,
  actionText,
  onActionPress,
  secondaryActionText,
  onSecondaryActionPress,
  style,
  ...props
}) => {
  const { theme, styles: themeStyles } = useTheme();

  const presets = {
    'no-data': {
      illustration: '📊',
      title: 'No Data Available',
      message: 'There\'s nothing to show here yet. Check back later or try refreshing.',
    },
    'no-results': {
      illustration: '🔍',
      title: 'No Results Found',
      message: 'We couldn\'t find anything matching your search. Try different keywords.',
    },
    'error': {
      illustration: '❌',
      title: 'Something Went Wrong',
      message: 'We encountered an error loading your data. Please try again.',
    },
    'offline': {
      illustration: '📶',
      title: 'You\'re Offline',
      message: 'Check your internet connection and try again.',
    },
    'loading-error': {
      illustration: '⚠️',
      title: 'Loading Failed',
      message: 'We couldn\'t load the content. Please check your connection and try again.',
    },
    'no-challenges': {
      illustration: '⚡',
      title: 'No Challenges Yet',
      message: 'You don\'t have any challenges. Create one or wait for friends to challenge you!',
    },
    'no-achievements': {
      illustration: '🏆',
      title: 'No Achievements',
      message: 'Keep playing to unlock your first achievement and start building your collection!',
    },
    'no-leaderboard': {
      illustration: '🏅',
      title: 'Leaderboard Empty',
      message: 'Be the first to appear on the leaderboard by playing some games!',
    },
    'no-profile': {
      illustration: '👤',
      title: 'Profile Not Found',
      message: 'The user profile you\'re looking for doesn\'t exist or has been removed.',
    },
    'maintenance': {
      illustration: '🔧',
      title: 'Under Maintenance',
      message: 'This feature is temporarily unavailable while we make improvements.',
    },
  };

  const preset = presets[type] || presets['no-data'];
  const finalTitle = title || preset.title;
  const finalMessage = message || preset.message;
  const finalIllustration = illustration || preset.illustration;

  return (
    <View style={[styles(theme).container, style]} {...props}>
      <View style={styles(theme).content}>
        {/* Illustration */}
        <View style={styles(theme).illustrationContainer}>
          <Text style={styles(theme).illustration}>
            {finalIllustration}
          </Text>
        </View>

        {/* Title */}
        <Text style={[themeStyles.heading3, styles(theme).title]}>
          {finalTitle}
        </Text>

        {/* Message */}
        <Text style={[themeStyles.body, styles(theme).message]}>
          {finalMessage}
        </Text>

        {/* Actions */}
        {(actionText || onActionPress) && (
          <View style={styles(theme).actions}>
            <Button
              title={actionText || 'Try Again'}
              onPress={onActionPress}
              variant="primary"
              size="medium"
              style={styles(theme).primaryAction}
            />
            
            {(secondaryActionText || onSecondaryActionPress) && (
              <Button
                title={secondaryActionText || 'Go Back'}
                onPress={onSecondaryActionPress}
                variant="outline"
                size="medium"
                style={styles(theme).secondaryAction}
              />
            )}
          </View>
        )}
      </View>
    </View>
  );
};

export const EmptyStateCard = ({
  title,
  message,
  illustration = '📝',
  compact = false,
  style,
  ...props
}) => {
  const { theme, styles: themeStyles } = useTheme();

  return (
    <View style={[styles(theme).card, compact && styles(theme).cardCompact, style]} {...props}>
      <Text style={styles(theme).cardIllustration}>
        {illustration}
      </Text>
      <Text style={[themeStyles.heading4, styles(theme).cardTitle]}>
        {title}
      </Text>
      {message && (
        <Text style={[themeStyles.caption, styles(theme).cardMessage]}>
          {message}
        </Text>
      )}
    </View>
  );
};

export const EmptyStateList = ({ 
  children, 
  loading = false, 
  error = false,
  isEmpty = false,
  emptyProps = {},
  errorProps = {},
}) => {
  if (loading) {
    return children;
  }

  if (error) {
    return (
      <EmptyState
        type="error"
        actionText="Retry"
        {...errorProps}
      />
    );
  }

  if (isEmpty) {
    return (
      <EmptyState
        type="no-data"
        {...emptyProps}
      />
    );
  }

  return children;
};

const styles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
    minHeight: 300,
  },
  content: {
    alignItems: 'center',
    maxWidth: 320,
  },
  illustrationContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.mode.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    borderWidth: 2,
    borderColor: theme.colors.mode.border,
  },
  illustration: {
    fontSize: 48,
    textAlign: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: theme.spacing.md,
    color: theme.colors.mode.text,
  },
  message: {
    textAlign: 'center',
    color: theme.colors.mode.textSecondary,
    lineHeight: theme.typography.lineHeights.relaxed * theme.typography.sizes.md,
    marginBottom: theme.spacing.xl,
  },
  actions: {
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    gap: theme.spacing.md,
  },
  primaryAction: {
    minWidth: 160,
  },
  secondaryAction: {
    minWidth: 160,
  },

  // Card variant styles
  card: {
    backgroundColor: theme.colors.mode.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.mode.border,
    margin: theme.spacing.md,
    ...theme.elevation.sm,
  },
  cardCompact: {
    padding: theme.spacing.lg,
  },
  cardIllustration: {
    fontSize: 32,
    marginBottom: theme.spacing.md,
  },
  cardTitle: {
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
    color: theme.colors.mode.text,
  },
  cardMessage: {
    textAlign: 'center',
    color: theme.colors.mode.textSecondary,
  },
});

export default EmptyState;