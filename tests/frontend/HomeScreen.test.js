import React from 'react';
import renderer from 'react-test-renderer';

// Mock contexts to isolate HomeScreen UI tree
jest.mock('../../frontend/src/context/SessionContext', () => ({
  useSession: () => ({
    resetTheme: jest.fn(),
    dashboard: { total_plays: 5, sports_played: ['football','tennis'] },
  })
}));
jest.mock('../../frontend/src/context/AuthContext', () => ({
  useAuth: () => ({
    createGuestSession: jest.fn(),
    user: { display_name: 'Tester' }
  })
}));
jest.mock('../../frontend/src/context/ThemeContext', () => {
  const React = require('react');
  const { lightTheme, createStyles } = require('../../frontend/src/design/theme.js');
  return {
    useTheme: () => ({ theme: lightTheme, styles: createStyles(lightTheme) })
  };
});

// Silence Animated warnings in snapshots
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

import HomeScreen from '../../frontend/src/screens/HomeScreen';

describe('HomeScreen', () => {
  it('renders without Speed mode and shows Quiz/Survival', () => {
    const testInstance = renderer.create(
      <HomeScreen navigation={{ navigate: jest.fn() }} />
    );
    const tree = testInstance.toJSON();
    const serialized = JSON.stringify(tree);

    // Removed Speed mode from chips and mode cards
    expect(serialized).not.toMatch(/Speed/i);
    // Keep core modes visible somewhere in the tree
    expect(serialized).toMatch(/Quiz/);
    expect(serialized).toMatch(/Survival/);
  });
});
