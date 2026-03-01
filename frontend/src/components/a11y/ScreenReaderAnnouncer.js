import React, { useEffect, useRef } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import useAccessibility from '../../hooks/useAccessibility';

const ScreenReaderAnnouncer = ({
  message,
  priority = 'polite',
  delay = 0,
  visible = false,
  liveRegion = 'polite',
  children,
  style,
  ...props
}) => {
  const { announce, screenReaderEnabled } = useAccessibility();
  const lastMessage = useRef('');

  useEffect(() => {
    if (message && message !== lastMessage.current) {
      announce(message, { priority, delay });
      lastMessage.current = message;
    }
  }, [message, announce, priority, delay]);

  // For live regions, render a hidden text element
  if (message && screenReaderEnabled && !children) {
    return (
      <View
        style={[styles.liveRegion, style]}
        accessibilityLiveRegion={liveRegion}
        accessible={true}
        {...props}
      >
        <Text style={styles.hiddenText}>
          {message}
        </Text>
      </View>
    );
  }

  // For visible announcements
  if (visible && message) {
    return (
      <View
        style={[styles.visibleAnnouncer, style]}
        accessibilityLiveRegion={liveRegion}
        accessible={true}
        {...props}
      >
        <Text style={styles.visibleText}>
          {message}
        </Text>
      </View>
    );
  }

  // Wrapper for child elements with live region
  if (children) {
    return (
      <View
        style={style}
        accessibilityLiveRegion={liveRegion}
        {...props}
      >
        {children}
      </View>
    );
  }

  return null;
};

// Game-specific announcer for quiz states
export const GameStateAnnouncer = ({
  score,
  question,
  timeRemaining,
  streak,
  lives,
  level,
}) => {
  const { announce } = useAccessibility();
  const previousState = useRef({});

  useEffect(() => {
    const current = { score, question, timeRemaining, streak, lives, level };
    const previous = previousState.current;

    // Announce score changes
    if (score !== previous.score && score !== undefined) {
      announce(`Score: ${score}`, { delay: 500 });
    }

    // Announce new questions
    if (question !== previous.question && question) {
      announce(`New question: ${question}`, { delay: 200 });
    }

    // Announce time warnings
    if (timeRemaining !== undefined && timeRemaining <= 10 && timeRemaining > 0) {
      if (previous.timeRemaining > 10 || previous.timeRemaining === undefined) {
        announce(`${timeRemaining} seconds remaining`, { priority: 'assertive' });
      }
    }

    // Announce streak milestones
    if (streak !== previous.streak && streak > 0) {
      const milestones = [5, 10, 15, 20, 25];
      if (milestones.includes(streak)) {
        announce(`${streak} correct answers in a row!`, { delay: 1000 });
      }
    }

    // Announce lives lost
    if (lives !== undefined && lives < previous.lives) {
      const remaining = lives === 1 ? 'Last life remaining!' : `${lives} lives remaining`;
      announce(remaining, { priority: 'assertive' });
    }

    // Announce level changes
    if (level !== previous.level && level !== undefined) {
      announce(`Level ${level}`, { delay: 800 });
    }

    previousState.current = current;
  }, [score, question, timeRemaining, streak, lives, level, announce]);

  return null;
};

// Challenge announcer
export const ChallengeAnnouncer = ({
  challengeStatus,
  opponentName,
  yourScore,
  opponentScore,
}) => {
  const { announce } = useAccessibility();
  const previousChallenge = useRef({});

  useEffect(() => {
    const current = { challengeStatus, opponentName, yourScore, opponentScore };
    const previous = previousChallenge.current;

    if (challengeStatus !== previous.challengeStatus) {
      switch (challengeStatus) {
        case 'started':
          announce(`Challenge started against ${opponentName}`, { delay: 500 });
          break;
        case 'won':
          announce(`Challenge won! Final score: ${yourScore} to ${opponentScore}`, { delay: 1000 });
          break;
        case 'lost':
          announce(`Challenge lost. Final score: ${yourScore} to ${opponentScore}`, { delay: 1000 });
          break;
        case 'tied':
          announce(`Challenge tied at ${yourScore} points each`, { delay: 1000 });
          break;
      }
    }

    previousChallenge.current = current;
  }, [challengeStatus, opponentName, yourScore, opponentScore, announce]);

  return null;
};

// Achievement announcer
export const AchievementAnnouncer = ({ achievement, unlocked }) => {
  const { announce } = useAccessibility();
  const previousAchievement = useRef(null);

  useEffect(() => {
    if (unlocked && achievement && achievement !== previousAchievement.current) {
      const message = `Achievement unlocked: ${achievement.name}. ${achievement.description}`;
      announce(message, { delay: 1500, priority: 'assertive' });
      previousAchievement.current = achievement;
    }
  }, [achievement, unlocked, announce]);

  return null;
};

// Navigation announcer
export const NavigationAnnouncer = ({ screenName, screenDescription }) => {
  const { announce } = useAccessibility();
  const previousScreen = useRef('');

  useEffect(() => {
    if (screenName && screenName !== previousScreen.current) {
      const message = screenDescription 
        ? `${screenName}. ${screenDescription}`
        : `Navigated to ${screenName}`;
      
      announce(message, { delay: 300 });
      previousScreen.current = screenName;
    }
  }, [screenName, screenDescription, announce]);

  return null;
};

const styles = StyleSheet.create({
  liveRegion: {
    position: 'absolute',
    left: -10000,
    width: 1,
    height: 1,
    overflow: 'hidden',
  },
  hiddenText: {
    fontSize: 0,
    color: 'transparent',
  },
  visibleAnnouncer: {
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    marginVertical: 4,
  },
  visibleText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
});

export default ScreenReaderAnnouncer;