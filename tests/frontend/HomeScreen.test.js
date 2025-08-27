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

it('renders HomeScreen skeleton structure (Phase 2+)', () => {
  const tree = renderer.create(<HomeScreen navigation={{ navigate: jest.fn() }} />).toJSON();
  expect(tree).toMatchSnapshot();
});
