import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Modal,
  Share,
  Clipboard,
  Alert,
  ScrollView
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import Button from './Button';

const ShareModal = ({
  visible = false,
  onClose,
  title = 'Share',
  shareData,
  showQR = false,
  customMessage,
  style,
  ...props
}) => {
  const { theme } = useTheme();
  const [copied, setCopied] = useState(false);

  const shareOptions = [
    {
      id: 'native',
      name: 'Share',
      icon: '📤',
      description: 'Use device share menu',
      action: handleNativeShare
    },
    {
      id: 'copy',
      name: 'Copy Link',
      icon: '📋',
      description: 'Copy to clipboard',
      action: handleCopyToClipboard
    },
    {
      id: 'message',
      name: 'Message',
      icon: '💬',
      description: 'Share via messages',
      action: () => handleCustomShare('message')
    },
    {
      id: 'social',
      name: 'Social Media',
      icon: '📱',
      description: 'Share on social platforms',
      action: () => handleCustomShare('social')
    }
  ];

  async function handleNativeShare() {
    try {
      const message = generateShareMessage();
      const result = await Share.share({
        message,
        title: shareData?.title || title
      });

      if (result.action === Share.sharedAction) {
        Alert.alert('Success', 'Shared successfully!');
        onClose?.();
      }
    } catch (error) {
      console.warn('Failed to share:', error);
      Alert.alert('Error', 'Failed to share content');
    }
  }

  async function handleCopyToClipboard() {
    try {
      const message = generateShareMessage();
      await Clipboard.setString(message);
      setCopied(true);
      
      setTimeout(() => {
        setCopied(false);
      }, 2000);

      Alert.alert('Copied!', 'Content copied to clipboard');
    } catch (error) {
      console.warn('Failed to copy:', error);
      Alert.alert('Error', 'Failed to copy to clipboard');
    }
  }

  function handleCustomShare(platform) {
    const message = generateShareMessage();
    
    // In a real app, you would integrate with platform-specific SDKs
    Alert.alert(
      'Share on ' + (platform === 'message' ? 'Messages' : 'Social Media'),
      'This would open the respective app with the pre-filled message:\n\n' + message,
      [
        { text: 'Cancel' },
        { 
          text: 'Copy Message', 
          onPress: () => handleCopyToClipboard()
        }
      ]
    );
  }

  function generateShareMessage() {
    if (customMessage) return customMessage;

    if (shareData?.type === 'achievement') {
      return `🏆 I just unlocked "${shareData.name}" on VerveQ! ${shareData.icon}\n\n${shareData.description}\n\nJoin me on VerveQ and test your sports knowledge!`;
    }

    if (shareData?.type === 'score') {
      return `🎯 I just scored ${shareData.score} points in ${shareData.sport} ${shareData.mode} mode on VerveQ!\n\nThink you can beat my score? Download VerveQ and challenge me!`;
    }

    if (shareData?.type === 'profile') {
      return `Check out my VerveQ profile! 🏆\n\n${shareData.stats}\n\nJoin me on VerveQ - the ultimate sports trivia challenge!`;
    }

    if (shareData?.type === 'challenge') {
      return `⚡ ${shareData.challenger} has challenged you to ${shareData.sport} ${shareData.mode} on VerveQ!\n\nAccept the challenge and prove your sports knowledge!`;
    }

    return `Join me on VerveQ - the ultimate sports trivia challenge! 🏆\n\nTest your knowledge, climb the leaderboards, and challenge friends!`;
  }

  const generateQRCode = () => {
    // In a real app, you would generate an actual QR code
    // For now, we'll show a placeholder
    return (
      <View style={styles(theme).qrContainer}>
        <View style={styles(theme).qrPlaceholder}>
          <Text style={styles(theme).qrText}>QR</Text>
        </View>
        <Text style={styles(theme).qrLabel}>Scan to join VerveQ</Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      {...props}
    >
      <View style={[styles(theme).container, style]}>
        {/* Header */}
        <View style={styles(theme).header}>
          <Text style={styles(theme).title}>{title}</Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles(theme).closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles(theme).closeIcon}>×</Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles(theme).content}
          showsVerticalScrollIndicator={false}
        >
          {/* Preview */}
          <View style={styles(theme).preview}>
            <Text style={styles(theme).previewTitle}>Preview</Text>
            <View style={styles(theme).previewContent}>
              <Text style={styles(theme).previewText}>
                {generateShareMessage()}
              </Text>
            </View>
          </View>

          {/* QR Code */}
          {showQR && generateQRCode()}

          {/* Share Options */}
          <View style={styles(theme).options}>
            <Text style={styles(theme).optionsTitle}>Share Options</Text>
            {shareOptions.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={styles(theme).option}
                onPress={option.action}
                activeOpacity={0.8}
              >
                <View style={styles(theme).optionIcon}>
                  <Text style={styles(theme).optionIconText}>{option.icon}</Text>
                </View>
                <View style={styles(theme).optionContent}>
                  <Text style={styles(theme).optionName}>{option.name}</Text>
                  <Text style={styles(theme).optionDescription}>
                    {option.description}
                  </Text>
                </View>
                <Text style={styles(theme).optionArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom Actions */}
          <View style={styles(theme).actions}>
            <Button
              title="Share Now"
              variant="primary"
              size="large"
              onPress={handleNativeShare}
              style={styles(theme).primaryAction}
            />
            <Button
              title={copied ? 'Copied!' : 'Copy to Clipboard'}
              variant="outline"
              size="large"
              onPress={handleCopyToClipboard}
              style={styles(theme).secondaryAction}
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.mode.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.mode.border,
    backgroundColor: theme.colors.mode.surface,
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.mode.text,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: theme.colors.mode.border + '40',
  },
  closeIcon: {
    fontSize: 24,
    color: theme.colors.mode.textSecondary,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  preview: {
    marginBottom: theme.spacing.xl,
  },
  previewTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.mode.text,
    marginBottom: theme.spacing.md,
  },
  previewContent: {
    backgroundColor: theme.colors.mode.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.mode.border,
  },
  previewText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.mode.text,
    lineHeight: theme.typography.lineHeights.relaxed * theme.typography.sizes.md,
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    backgroundColor: theme.colors.mode.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
  },
  qrPlaceholder: {
    width: 120,
    height: 120,
    backgroundColor: theme.colors.mode.border,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  qrText: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.mode.textSecondary,
  },
  qrLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.mode.textSecondary,
  },
  options: {
    marginBottom: theme.spacing.xl,
  },
  optionsTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.mode.text,
    marginBottom: theme.spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.mode.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.mode.border,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  optionIconText: {
    fontSize: 18,
  },
  optionContent: {
    flex: 1,
  },
  optionName: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.mode.text,
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.mode.textSecondary,
  },
  optionArrow: {
    fontSize: 18,
    color: theme.colors.mode.textSecondary,
    fontWeight: 'bold',
  },
  actions: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  primaryAction: {
    marginBottom: theme.spacing.sm,
  },
  secondaryAction: {
    // Secondary action styles
  },
});

export default ShareModal;