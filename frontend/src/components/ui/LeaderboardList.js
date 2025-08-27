import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  RefreshControl,
  ActivityIndicator,
  Animated
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import LeaderboardCard from './LeaderboardCard';

const LeaderboardList = ({
  data = [],
  loading = false,
  refreshing = false,
  onRefresh,
  onUserPress,
  onChallenge,
  showPosition = true,
  style,
  ...props
}) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (data.length > 0) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  }, [data]);

  const isCurrentUser = (leaderboardUser) => {
    return user && leaderboardUser.id === user.id;
  };

  const renderItem = ({ item, index }) => {
    const rank = item.rank || index + 1;
    
    return (
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{
            translateY: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [50, 0],
            })
          }]
        }}
      >
        <LeaderboardCard
          entry={item}
          rank={rank}
          isCurrentUser={isCurrentUser(item.user)}
          onPress={() => onUserPress?.(item.user)}
          onChallenge={onChallenge}
          style={styles(theme).cardStyle}
        />
      </Animated.View>
    );
  };

  const renderEmpty = () => (
    <View style={styles(theme).emptyContainer}>
      <Text style={styles(theme).emptyIcon}>🏆</Text>
      <Text style={styles(theme).emptyText}>No rankings available</Text>
      <Text style={styles(theme).emptySubtext}>
        Play more games to appear on the leaderboard!
      </Text>
    </View>
  );

  const renderHeader = () => {
    if (!showPosition || data.length === 0) return null;

    const currentUserEntry = data.find(entry => isCurrentUser(entry.user));
    if (!currentUserEntry) return null;

    return (
      <View style={styles(theme).positionHeader}>
        <Text style={styles(theme).positionTitle}>Your Position</Text>
        <View style={styles(theme).currentUserHighlight}>
          <Text style={styles(theme).positionRank}>#{currentUserEntry.rank}</Text>
          <Text style={styles(theme).positionDetails}>
            {Math.round(currentUserEntry.elo_rating)} ELO
          </Text>
        </View>
      </View>
    );
  };

  if (loading && data.length === 0) {
    return (
      <View style={styles(theme).loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary[500]} />
        <Text style={styles(theme).loadingText}>Loading rankings...</Text>
      </View>
    );
  }

  return (
    <View style={[styles(theme).container, style]} {...props}>
      {renderHeader()}
      
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${item.user.id}-${index}`}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={[theme.colors.primary[500]]}
            tintColor={theme.colors.primary[500]}
          />
        }
        ListEmptyComponent={!loading ? renderEmpty : null}
        ItemSeparatorComponent={() => <View style={styles(theme).separator} />}
        contentContainerStyle={[
          styles(theme).listContent,
          data.length === 0 && styles(theme).listContentEmpty
        ]}
        initialNumToRender={10}
        maxToRenderPerBatch={5}
        windowSize={10}
        getItemLayout={(data, index) => ({
          length: 80,
          offset: 80 * index,
          index,
        })}
      />
    </View>
  );
};

const styles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.mode.surface,
    borderRadius: theme.borderRadius.lg,
    ...theme.elevation.sm,
    overflow: 'hidden',
  },
  positionHeader: {
    backgroundColor: theme.colors.primary[50],
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.mode.border,
  },
  positionTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.mode.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  currentUserHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  positionRank: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary[600],
  },
  positionDetails: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.mode.text,
  },
  listContent: {
    padding: theme.spacing.md,
  },
  listContentEmpty: {
    flex: 1,
    justifyContent: 'center',
  },
  cardStyle: {
    marginVertical: theme.spacing.xs,
  },
  separator: {
    height: theme.spacing.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.mode.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: theme.spacing.lg,
  },
  emptyText: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.mode.text,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.mode.textSecondary,
    textAlign: 'center',
    lineHeight: theme.typography.lineHeights.relaxed * theme.typography.sizes.md,
    maxWidth: 250,
  },
});

export default LeaderboardList;