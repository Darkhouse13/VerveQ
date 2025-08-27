import React, { useState, useEffect } from 'react';
import { Pressable } from 'react-native';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Animated,
  Dimensions,
  FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSession } from '../context/SessionContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
// UI components
import Card from '../components/ui/Card';
import StatsCard from '../components/ui/StatsCard';
import { MetricChip, FilterChip, ChallengeCard, FeaturedGameCard, SegmentedButtons, AnimatedSection } from '../components/home';
import useDynamicSizing from '../hooks/useDynamicSizing';

const { width } = Dimensions.get('window');

const HomeScreen = ({ navigation }) => {
  const { resetTheme, dashboard } = useSession();
  const { createGuestSession, user } = useAuth();
  const { theme, styles: themeStyles } = useTheme();
  const { isTablet } = useDynamicSizing();

  const [userPreferences, setUserPreferences] = useState({
    preferredSports: [],
    skillLevel: 'intermediate',
  });
  const [recentAchievements, setRecentAchievements] = useState([]);
  // Removed inline segment button (extracted to SegmentedButtons component)

  const [quickStats, setQuickStats] = useState({
    gamesPlayed: 42,
    currentStreak: 7,
    bestScore: 85,
    recentPerformance: 73,
  });
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [activeQuickAction, setActiveQuickAction] = useState('resume');
  const [activeFilter, setActiveFilter] = useState('suggested');
  const [dailyChallenges, setDailyChallenges] = useState([]);
  const [friends, setFriends] = useState([]); // Placeholder avatars/friends
  const [featuredMode, setFeaturedMode] = useState(null);

  // Load user preferences and animate entrance
  useEffect(() => {
    resetTheme();
    loadUserPreferences();
  // Immediate lightweight data
  loadDailyChallenges();
  restoreFilter();
  // Defer heavier lists slightly
  setTimeout(() => { loadFriends(); loadRecentAchievements(); }, 250);
    
    // Animate screen entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const loadUserPreferences = async () => {
    try {
      const sports = await AsyncStorage.getItem('verveq_preferred_sports');
      const skillLevel = await AsyncStorage.getItem('verveq_skill_level');
      
      setUserPreferences({
        preferredSports: sports ? JSON.parse(sports) : ['football'],
        skillLevel: skillLevel || 'intermediate',
      });
    } catch (error) {
      console.error('Error loading user preferences:', error);
    }
  };

  const loadRecentAchievements = async () => {
    // Mock recent achievements - in real app, load from API
    setRecentAchievements([
      { id: 1, name: 'Quiz Master', icon: '🎯', unlockedAt: Date.now() - 86400000 },
      { id: 2, name: 'Streak Runner', icon: '🔥', unlockedAt: Date.now() - 172800000 },
    ]);
  };

  const loadDailyChallenges = () => {
    // Placeholder challenge data; future: fetch from API
    setDailyChallenges([
      { id: 'dq', title: 'Daily Quiz', subtitle: '10 fresh questions', variant: 'primary', icon: '🧠', mode: 'quiz' },
      { id: 'sr', title: 'Survival Sprint', subtitle: 'Beat yesterday\'s run', variant: 'secondary', icon: '⚡', mode: 'survival' },
    ]);
  };

  const loadFriends = () => {
    // Placeholder avatars; later replace with API
    setFriends([
      { id: 'u1', name: 'Alex', initials: 'AL' },
      { id: 'u2', name: 'Brooke', initials: 'BR' },
      { id: 'u3', name: 'Casey', initials: 'CA' },
      { id: 'u4', name: 'Dev', initials: 'DV' },
      { id: 'u5', name: 'Eli', initials: 'EL' },
    ]);
  };

  const computeFeaturedMode = (filter) => {
    // Simple mapping for placeholder featured content
    const base = {
      suggested: { tag: 'Quiz', title: 'Fast Quiz', subtitle: 'Sharpen your knowledge in a quick 10-question run', mode: 'quiz' },
      quiz: { tag: 'Quiz', title: 'Challenge Quiz', subtitle: 'Higher difficulty. Bigger rewards.', mode: 'quiz' },
      survival: { tag: 'Survival', title: 'Endless Survival', subtitle: 'How many players can you guess in a row?', mode: 'survival' },
      speed: { tag: 'Speed', title: 'Time Attack', subtitle: 'Beat the clock. Accuracy under pressure.', mode: 'quiz' },
      archives: { tag: 'Archives', title: 'Historic Quiz', subtitle: 'Classic questions from past seasons.', mode: 'quiz' },
    };
    setFeaturedMode(base[filter] || base.suggested);
  };

  const handleFilterSelect = (filter) => {
    setActiveFilter(filter);
    computeFeaturedMode(filter);
    AsyncStorage.setItem('verveq_active_filter', filter).catch(()=>{});
  };

  const restoreFilter = async () => {
    try {
      const saved = await AsyncStorage.getItem('verveq_active_filter');
      if (saved) {
        setActiveFilter(saved);
        computeFeaturedMode(saved);
        return;
      }
    } catch {}
    computeFeaturedMode('suggested');
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getPrimarySportColor = () => {
    const primarySport = userPreferences.preferredSports[0] || 'football';
    const sportColors = {
      football: theme.colors.secondary.emerald,
      tennis: theme.colors.secondary.amber,
      basketball: theme.colors.secondary.coral,
    };
    return sportColors[primarySport] || theme.colors.primary[500];
  };

  const navigateToQuiz = () => {
    navigation.navigate('SportSelection', { mode: 'quiz' });
  };

  const navigateToSurvival = () => {
    navigation.navigate('SportSelection', { mode: 'survival' });
  };

  const navigateToDashboard = () => {
    navigation.navigate('Dashboard');
  };

  const handleGuestPress = async () => {
    try {
      const result = await createGuestSession();
      if (result.success) {
        navigation.navigate('SportSelection', { mode: 'guest' });
      } else {
        console.error('Guest session failed:', result.error);
      }
    } catch (error) {
      console.error('Guest session error:', error);
    }
  };

  return (
    <SafeAreaView style={[themeStyles.container, styles(theme).container]}>
      <Animated.View 
        style={[
          styles(theme).animatedContainer,
          { 
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <ScrollView 
          style={styles(theme).scrollView}
          contentContainerStyle={styles(theme).scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Metrics Row (Phase 1) */}
          <AnimatedSection delay={50}>
            <View style={styles(theme).metricsRow}>
              <MetricChip icon="🔥" value={quickStats.currentStreak} label="Streak" />
              <MetricChip icon="🎯" value={quickStats.bestScore} label="Best" />
              <MetricChip icon="▶" value={dashboard?.total_plays || quickStats.gamesPlayed} label="Plays" />
            </View>
          </AnimatedSection>

          {/* Avatars Row Placeholder */}
            <AnimatedSection delay={120}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles(theme).avatarsRow}
              contentContainerStyle={styles(theme).avatarsContent}
            >
              {friends.map(f => (
                <View key={f.id} style={styles(theme).avatarItem}>
                  <View style={styles(theme).avatarCircle}>
                    <Text style={styles(theme).avatarInitials}>{f.initials}</Text>
                  </View>
                  <Text style={styles(theme).avatarLabel}>{f.name}</Text>
                </View>
              ))}
            </ScrollView>
            </AnimatedSection>

          {/* Daily Challenges */}
          {dailyChallenges.length > 0 && (
            <AnimatedSection delay={200} style={styles(theme).challengesSection}>
              <Text style={[themeStyles.heading3, styles(theme).sectionHeading]}>Today\'s Challenges</Text>
              <View style={styles(theme).challengeRow}>
                {dailyChallenges.map(ch => (
                  <ChallengeCard
                    key={ch.id}
                    title={ch.title}
                    subtitle={ch.subtitle}
                    variant={ch.variant}
                    icon={ch.icon}
                    onPress={() => navigation.navigate('SportSelection', { mode: ch.mode })}
                  />
                ))}
              </View>
            </AnimatedSection>
          )}

          {/* Filter Chips Row */}
          <AnimatedSection delay={260}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles(theme).filtersRow}
            contentContainerStyle={styles(theme).filtersContent}
          >
            {['suggested','quiz','survival','speed','archives'].map(f => (
              <FilterChip
                key={f}
                label={f.charAt(0).toUpperCase() + f.slice(1)}
                selected={activeFilter === f}
                onPress={() => handleFilterSelect(f)}
              />
            ))}
          </ScrollView>
          </AnimatedSection>

          {/* Featured Mode Card */}
          {featuredMode && (
            <AnimatedSection delay={320} style={styles(theme).featuredWrapper}>
              <FeaturedGameCard
                tag={featuredMode.tag}
                title={featuredMode.title}
                subtitle={featuredMode.subtitle}
                progress={0.4}
                onPlay={() => navigation.navigate('SportSelection', { mode: featuredMode.mode })}
              />
            </AnimatedSection>
          )}

          {/* Hero Section only shown when no featured card */}
          {!featuredMode && (
          <AnimatedSection delay={380} style={[styles(theme).heroSection, { backgroundColor: getPrimarySportColor() + '15' }]}>            
            <View style={styles(theme).heroTextWrapper}>
              <Text style={[themeStyles.body, styles(theme).greeting]}>
                {getGreeting()}{user ? `, ${user.display_name}` : ''}
              </Text>
              <Text style={[themeStyles.heading1, styles(theme).heroTitle]} includeFontPadding={true}>
                Ready to Compete?
              </Text>
              <Text style={[themeStyles.caption, styles(theme).heroSubtitle]}>
                Challenge yourself in sports trivia and climb the global rankings
              </Text>
            </View>
            <View style={styles(theme).segmentedActions}>
              <SegmentedButtons
                activeKey={activeQuickAction}
                items={[
                  { key: 'resume', label: 'Resume Game', onPress: () => { setActiveQuickAction('resume'); navigation.navigate('SportSelection', { mode: 'resume' }); } },
                  { key: 'quick', label: 'Quick Challenge', onPress: () => { setActiveQuickAction('quick'); navigation.navigate('SportSelection', { mode: 'quick' }); } },
                ]}
              />
            </View>
          </AnimatedSection>
          )}

          {/* Stats Dashboard */}
          {/* StatsCard removed (metrics row replaces) */}

          {/* Modes Grid Placeholder (reuse existing two modes for now) */}
          <AnimatedSection delay={440} style={styles(theme).modesGridWrapper}>
            <Text style={[themeStyles.heading3, styles(theme).sectionHeading]}>All Modes</Text>
            <View style={[styles(theme).modesGrid, isTablet && styles(theme).modesGridTablet]}>              
              <Card
                variant="default"
                elevation="lg"
                pressable
                onPress={navigateToQuiz}
                style={[styles(theme).modeCardSmall, styles(theme).quizModeCard]}
              >
                <View style={styles(theme).modeCardContentSmall}>
                  <Text style={styles(theme).modeSmallTag}>QUIZ</Text>
                  <Text style={styles(theme).modeSmallTitle}>Quiz</Text>
                </View>
              </Card>
              <Card
                variant="default"
                elevation="lg"
                pressable
                onPress={navigateToSurvival}
                style={[styles(theme).modeCardSmall, styles(theme).survivalModeCard]}
              >
                <View style={styles(theme).modeCardContentSmall}>
                  <Text style={styles(theme).modeSmallTag}>SURVIVAL</Text>
                  <Text style={styles(theme).modeSmallTitle}>Survival</Text>
                </View>
              </Card>
              <Card
                variant="default"
                elevation="lg"
                pressable
                onPress={() => navigation.navigate('SportSelection', { mode: 'quiz', speed: true })}
                style={[styles(theme).modeCardSmall, styles(theme).speedModeCard]}
              >
                <View style={styles(theme).modeCardContentSmall}>
                  <Text style={styles(theme).modeSmallTag}>SPEED</Text>
                  <Text style={styles(theme).modeSmallTitle}>Speed</Text>
                </View>
              </Card>
            </View>
          </AnimatedSection>

          {/* Recent Achievements */}
          {recentAchievements.length > 0 && (
            <Card elevation="md" style={styles(theme).achievementsCard}>
              <Text style={[themeStyles.heading3, styles(theme).achievementsTitle]}>
                Recent Achievements
              </Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles(theme).achievementsScroll}
              >
                {recentAchievements.map((achievement) => (
                  <View key={achievement.id} style={styles(theme).achievementItem}>
                    <Text style={styles(theme).achievementIcon}>{achievement.icon}</Text>
                    <Text style={[themeStyles.caption, styles(theme).achievementName]}>
                      {achievement.name}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </Card>
          )}

          {/* Enhanced Dashboard Link */}
          {dashboard && dashboard.total_plays > 0 && (
            <Card
              variant="accent"
              elevation="md"
              pressable
              onPress={navigateToDashboard}
              style={styles(theme).dashboardCard}
            >
              <View style={styles(theme).dashboardContent}>
                <View>
                  <Text style={[themeStyles.heading3, styles(theme).dashboardTitle]}>
                    View Full Dashboard
                  </Text>
                  <Text style={[themeStyles.caption, styles(theme).dashboardStats]}>
                    {dashboard.total_plays} games • {dashboard.sports_played.length} sports
                  </Text>
                </View>
                <Text style={styles(theme).dashboardArrow}>→</Text>
              </View>
            </Card>
          )}
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = (theme) => StyleSheet.create({
  container: {
    // Additional container styles if needed
  },
  animatedContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  heroSection: {
    borderRadius: theme.borderRadius.xl,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
    alignItems: 'center',
  },
  heroTextWrapper: {
    width: '100%',
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  greeting: {
    color: theme.colors.mode.textSecondary,
    marginBottom: theme.spacing.sm,
  width: '100%',
  textAlign: 'center',
  },
  heroTitle: {
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
    color: theme.colors.mode.text,
    width: '100%',
    // Safe lineHeight to avoid truncation (Phase 0 fix)
    lineHeight: Math.round(theme.typography.sizes['4xl'] * 1.15),
  },
  heroSubtitle: {
    textAlign: 'center',
    color: theme.colors.mode.textSecondary,
    marginBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
  width: '100%',
  lineHeight: Math.round(theme.typography.sizes.md * theme.typography.lineHeights.relaxed),
  },
  segmentedActions: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 340,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.mode.border,
    backgroundColor: theme.colors.mode.surfaceVariant,
    marginTop: theme.spacing.md,
  },
  segmentButtonBase: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonActive: {
    backgroundColor: theme.colors.primary[500],
  },
  segmentButtonInactive: {
    backgroundColor: 'transparent',
  },
  segmentText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    letterSpacing: 0.5,
    color: theme.colors.mode.textSecondary,
  },
  segmentTextActive: {
    color: '#ffffff',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  avatarsRow: {
    marginBottom: theme.spacing.lg,
  },
  avatarsContent: {
    paddingRight: theme.spacing.md,
  },
  avatarItem: {
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.mode.surfaceVariant,
    borderWidth: 1,
    borderColor: theme.colors.mode.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xs,
  },
  avatarInitials: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.mode.text,
  },
  avatarLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.mode.textSecondary,
  },
  challengesSection: {
    marginBottom: theme.spacing.xl,
  },
  sectionHeading: {
    textAlign: 'left',
    marginBottom: theme.spacing.md,
  },
  challengeRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  filtersRow: {
    marginBottom: theme.spacing.lg,
  },
  filtersContent: {
    paddingRight: theme.spacing.md,
  },
  featuredWrapper: {
    marginBottom: theme.spacing.xl,
  },
  modesGridWrapper: {
    marginBottom: theme.spacing.xl,
  },
  modesGrid: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  modesGridTablet: {
    flexWrap: 'wrap',
  },
  modeCardSmall: {
    flex: 1,
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
  },
  modeCardContentSmall: {
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  modeSmallTag: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    letterSpacing: 1,
    color: theme.colors.mode.textSecondary,
  },
  modeSmallTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.mode.text,
  },
  statsCard: {
    marginBottom: theme.spacing.lg,
  },
  modesContainer: {
    gap: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  modeCard: {
    // Base card styling handled by Card component
  },
  quizModeCard: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.secondary.emerald,
  },
  survivalModeCard: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.secondary.coral,
  },
  speedModeCard: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.secondary.amber,
  },
  modeCardContent: {
    alignItems: 'center',
  },
  modeIconContainer: {
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  modeIconText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 1,
  },
  modeTitle: {
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  width: '100%',
  },
  modeDescription: {
    textAlign: 'center',
    lineHeight: theme.typography.lineHeights.relaxed * theme.typography.sizes.sm,
    marginBottom: theme.spacing.md,
  width: '100%',
  },
  modeProgress: {
    width: '100%',
    alignItems: 'center',
  },
  modeProgressText: {
    color: theme.colors.mode.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: theme.colors.mode.border,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: theme.borderRadius.sm,
  },
  achievementsCard: {
    marginBottom: theme.spacing.lg,
  },
  achievementsTitle: {
    marginBottom: theme.spacing.md,
  },
  achievementsScroll: {
    marginHorizontal: -theme.spacing.md,
  },
  achievementItem: {
    alignItems: 'center',
    marginHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  achievementIcon: {
    fontSize: 24,
    marginBottom: theme.spacing.xs,
  },
  achievementName: {
    textAlign: 'center',
    color: theme.colors.mode.textSecondary,
  },
  dashboardCard: {
    marginBottom: theme.spacing.lg,
  },
  dashboardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dashboardTitle: {
    marginBottom: theme.spacing.xs,
  },
  dashboardStats: {
    color: theme.colors.mode.textSecondary,
  },
  dashboardArrow: {
    fontSize: theme.typography.sizes.lg,
    color: theme.colors.primary[500],
    fontWeight: theme.typography.weights.bold,
  },
});

export default HomeScreen;