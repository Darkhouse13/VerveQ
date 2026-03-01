import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import useGestures from '../../hooks/useGestures';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const LongPressMenu = ({
  children,
  menuItems = [],
  onLongPress,
  longPressDelay = 600,
  disabled = false,
  style,
  ...props
}) => {
  const { theme } = useTheme();
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [pressLocation, setPressLocation] = useState({ x: 0, y: 0 });
  
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const pressScaleAnim = useRef(new Animated.Value(1)).current;
  const containerRef = useRef(null);

  const showMenu = (evt) => {
    if (disabled || menuItems.length === 0) return;

    // Get touch position
    const { pageX, pageY } = evt.nativeEvent;
    setPressLocation({ x: pageX, y: pageY });

    // Measure container to position menu
    if (containerRef.current) {
      containerRef.current.measure((x, y, width, height, pageX, pageY) => {
        const menuX = Math.min(pageX, screenWidth - 200); // Ensure menu fits on screen
        const menuY = Math.max(50, Math.min(pageY + height + 10, screenHeight - 300));
        
        setMenuPosition({ x: menuX, y: menuY });
        setMenuVisible(true);
        
        // Animate menu appearance
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }

    // Call custom long press handler
    onLongPress?.(evt);
  };

  const hideMenu = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setMenuVisible(false);
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
    });
  };

  const handleMenuItemPress = (item) => {
    hideMenu();
    
    // Small delay to allow menu to close before action
    setTimeout(() => {
      item.onPress?.(pressLocation);
    }, 150);
  };

  const { panResponder } = useGestures({
    onLongPress: showMenu,
    longPressDelay,
    enabled: !disabled,
  });

  // Handle press animation
  const handlePressIn = () => {
    Animated.spring(pressScaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  return (
    <>
      <TouchableWithoutFeedback
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
      >
        <Animated.View
          ref={containerRef}
          style={[
            {
              transform: [{ scale: pressScaleAnim }],
            },
            style
          ]}
          {...panResponder.panHandlers}
          {...props}
        >
          {children}
        </Animated.View>
      </TouchableWithoutFeedback>

      {/* Context Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="none"
        onRequestClose={hideMenu}
      >
        <TouchableWithoutFeedback onPress={hideMenu}>
          <View style={styles(theme).overlay}>
            <Animated.View
              style={[
                styles(theme).menu,
                {
                  left: menuPosition.x,
                  top: menuPosition.y,
                  transform: [{ scale: scaleAnim }],
                  opacity: opacityAnim,
                },
              ]}
            >
              {/* Menu Arrow */}
              <View style={styles(theme).arrow} />
              
              {/* Menu Items */}
              {menuItems.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles(theme).menuItem,
                    item.destructive && styles(theme).destructiveItem,
                    index === 0 && styles(theme).firstMenuItem,
                    index === menuItems.length - 1 && styles(theme).lastMenuItem,
                  ]}
                  onPress={() => handleMenuItemPress(item)}
                  disabled={item.disabled}
                >
                  {item.icon && (
                    <Text style={[
                      styles(theme).menuIcon,
                      item.destructive && styles(theme).destructiveText,
                      item.disabled && styles(theme).disabledText,
                    ]}>
                      {item.icon}
                    </Text>
                  )}
                  <Text style={[
                    styles(theme).menuText,
                    item.destructive && styles(theme).destructiveText,
                    item.disabled && styles(theme).disabledText,
                  ]}>
                    {item.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </Animated.View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
};

// Preset context menus for common use cases
export const UserContextMenu = ({ user, onChallenge, onViewProfile, onBlock, children, ...props }) => {
  const menuItems = [
    {
      title: 'View Profile',
      icon: '👤',
      onPress: () => onViewProfile?.(user),
    },
    {
      title: 'Challenge',
      icon: '⚡',
      onPress: () => onChallenge?.(user),
    },
    {
      title: 'Block User',
      icon: '🚫',
      destructive: true,
      onPress: () => onBlock?.(user),
    },
  ].filter(item => item.onPress); // Only show items with handlers

  return (
    <LongPressMenu menuItems={menuItems} {...props}>
      {children}
    </LongPressMenu>
  );
};

export const ChallengeContextMenu = ({ challenge, onAccept, onDecline, onViewDetails, children, ...props }) => {
  const menuItems = [
    {
      title: 'View Details',
      icon: '👁️',
      onPress: () => onViewDetails?.(challenge),
    },
    {
      title: 'Accept Challenge',
      icon: '✅',
      onPress: () => onAccept?.(challenge),
    },
    {
      title: 'Decline Challenge',
      icon: '❌',
      destructive: true,
      onPress: () => onDecline?.(challenge),
    },
  ].filter(item => item.onPress);

  return (
    <LongPressMenu menuItems={menuItems} {...props}>
      {children}
    </LongPressMenu>
  );
};

export const AchievementContextMenu = ({ achievement, onShare, onViewDetails, children, ...props }) => {
  const menuItems = [
    {
      title: 'View Details',
      icon: '📋',
      onPress: () => onViewDetails?.(achievement),
    },
    {
      title: 'Share Achievement',
      icon: '📤',
      onPress: () => onShare?.(achievement),
    },
  ].filter(item => item.onPress);

  return (
    <LongPressMenu menuItems={menuItems} {...props}>
      {children}
    </LongPressMenu>
  );
};

const styles = (theme) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  menu: {
    position: 'absolute',
    backgroundColor: theme.colors.mode.surface,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.sm,
    minWidth: 180,
    ...theme.elevation.lg,
  },
  arrow: {
    position: 'absolute',
    top: -6,
    left: 20,
    width: 12,
    height: 12,
    backgroundColor: theme.colors.mode.surface,
    transform: [{ rotate: '45deg' }],
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: 'transparent',
  },
  firstMenuItem: {
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
  },
  lastMenuItem: {
    borderBottomLeftRadius: theme.borderRadius.lg,
    borderBottomRightRadius: theme.borderRadius.lg,
  },
  destructiveItem: {
    backgroundColor: theme.colors.error.light + '20',
  },
  menuIcon: {
    fontSize: 16,
    marginRight: theme.spacing.md,
    width: 20,
    textAlign: 'center',
  },
  menuText: {
    flex: 1,
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.mode.text,
  },
  destructiveText: {
    color: theme.colors.error.main,
  },
  disabledText: {
    color: theme.colors.mode.textDisabled,
    opacity: 0.5,
  },
});

export default LongPressMenu;