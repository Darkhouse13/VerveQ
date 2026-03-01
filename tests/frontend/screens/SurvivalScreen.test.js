/**
 * Unit tests for SurvivalScreen component.
 * Tests survival game functionality and result submission.
 */
import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import SurvivalScreen from '../../../frontend/src/screens/SurvivalScreen';
import { AuthContext } from '../../../frontend/src/context/AuthContext';
import api from '../../../frontend/src/config/api';

// Mock the API
jest.mock('../../../frontend/src/config/api');
const mockApi = api;

// Mock navigation
const mockNavigate = jest.fn();
const mockRoute = {
  params: {
    sport: 'football'
  }
};

const mockNavigation = {
  navigate: mockNavigate,
  setOptions: jest.fn(),
  goBack: jest.fn()
};

// Mock AuthContext
const createMockAuthContext = (user = null) => ({
  user,
  login: jest.fn(),
  logout: jest.fn(),
  loading: false
});

// Test wrapper component
const TestWrapper = ({ children, authValue }) => {
  const Stack = createStackNavigator();
  
  return (
    <NavigationContainer>
      <AuthContext.Provider value={authValue}>
        <Stack.Navigator>
          <Stack.Screen name="Survival" component={() => children} />
        </Stack.Navigator>
      </AuthContext.Provider>
    </NavigationContainer>
  );
};

describe('SurvivalScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default API mock responses
    mockApi.post = jest.fn()
      .mockResolvedValueOnce({
        data: {
          initials: 'CR',
          round: 1,
          lives: 3
        }
      })
      .mockResolvedValue({
        data: {
          correct: true,
          round: 2,
          lives: 3,
          score: 1
        }
      });
  });

  describe('Component Rendering', () => {
    test('renders survival screen correctly for authenticated user', async () => {
      const authValue = createMockAuthContext({ 
        id: 'user123', 
        username: 'testuser' 
      });

      render(
        <TestWrapper authValue={authValue}>
          <SurvivalScreen route={mockRoute} navigation={mockNavigation} />
        </TestWrapper>
      );

      // Wait for game to start
      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith('/football/survival/start');
      });

      // Should show initials
      await waitFor(() => {
        expect(screen.getByText('CR')).toBeTruthy();
      });

      // Should show round and lives
      expect(screen.getByText(/Round.*1/)).toBeTruthy();
      expect(screen.getByText(/Lives.*3/)).toBeTruthy();
    });

    test('renders survival screen for guest user', async () => {
      const authValue = createMockAuthContext(null); // Guest user

      render(
        <TestWrapper authValue={authValue}>
          <SurvivalScreen route={mockRoute} navigation={mockNavigation} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('CR')).toBeTruthy();
      });

      // Guest should still be able to play
      expect(screen.getByText(/Round.*1/)).toBeTruthy();
    });

    test('shows input field for player name guesses', async () => {
      const authValue = createMockAuthContext({ 
        id: 'user123', 
        username: 'testuser' 
      });

      render(
        <TestWrapper authValue={authValue}>
          <SurvivalScreen route={mockRoute} navigation={mockNavigation} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('CR')).toBeTruthy();
      });

      // Should have text input for guesses
      expect(screen.getByPlaceholderText(/Enter player name/i)).toBeTruthy();
    });
  });

  describe('Survival Gameplay', () => {
    test('handles correct player name guess', async () => {
      const authValue = createMockAuthContext({ 
        id: 'user123', 
        username: 'testuser' 
      });

      mockApi.post
        .mockResolvedValueOnce({
          data: { initials: 'LM', round: 1, lives: 3 }
        })
        .mockResolvedValueOnce({
          data: { correct: true, round: 2, lives: 3, score: 1 }
        });

      render(
        <TestWrapper authValue={authValue}>
          <SurvivalScreen route={mockRoute} navigation={mockNavigation} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('LM')).toBeTruthy();
      });

      // Enter a guess
      const input = screen.getByPlaceholderText(/Enter player name/i);
      fireEvent.changeText(input, 'Lionel Messi');
      
      // Submit the guess
      const submitButton = screen.getByText(/Submit/i) || screen.getByText(/Guess/i);
      fireEvent.press(submitButton);

      // Should make API call for guess
      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith(
          '/football/survival/guess',
          { player_name: 'Lionel Messi' }
        );
      });

      // Should advance to next round
      await waitFor(() => {
        expect(screen.getByText(/Round.*2/)).toBeTruthy();
      });

      // Lives should remain the same
      expect(screen.getByText(/Lives.*3/)).toBeTruthy();
    });

    test('handles incorrect player name guess', async () => {
      const authValue = createMockAuthContext({ 
        id: 'user123', 
        username: 'testuser' 
      });

      mockApi.post
        .mockResolvedValueOnce({
          data: { initials: 'CR', round: 1, lives: 3 }
        })
        .mockResolvedValueOnce({
          data: { correct: false, round: 1, lives: 2, score: 0 }
        });

      render(
        <TestWrapper authValue={authValue}>
          <SurvivalScreen route={mockRoute} navigation={mockNavigation} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('CR')).toBeTruthy();
      });

      // Make wrong guess
      const input = screen.getByPlaceholderText(/Enter player name/i);
      fireEvent.changeText(input, 'Wrong Player');
      
      const submitButton = screen.getByText(/Submit/i) || screen.getByText(/Guess/i);
      fireEvent.press(submitButton);

      // Should lose a life
      await waitFor(() => {
        expect(screen.getByText(/Lives.*2/)).toBeTruthy();
      });

      // Round should stay the same
      expect(screen.getByText(/Round.*1/)).toBeTruthy();
    });

    test('tracks game score correctly', async () => {
      const authValue = createMockAuthContext({ 
        id: 'user123', 
        username: 'testuser' 
      });

      mockApi.post
        .mockResolvedValueOnce({
          data: { initials: 'KM', round: 1, lives: 3 }
        })
        .mockResolvedValueOnce({
          data: { correct: true, round: 2, lives: 3, score: 1 }
        })
        .mockResolvedValueOnce({
          data: { correct: true, round: 3, lives: 3, score: 2 }
        });

      render(
        <TestWrapper authValue={authValue}>
          <SurvivalScreen route={mockRoute} navigation={mockNavigation} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('KM')).toBeTruthy();
      });

      // Make first correct guess
      const input = screen.getByPlaceholderText(/Enter player name/i);
      fireEvent.changeText(input, 'Kylian Mbappe');
      
      const submitButton = screen.getByText(/Submit/i) || screen.getByText(/Guess/i);
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Round.*2/)).toBeTruthy();
      });

      // Score should be displayed
      expect(screen.getByText(/Score.*1/) || screen.getByText(/1/)).toBeTruthy();

      // Make second correct guess
      fireEvent.changeText(input, 'Another Player');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Round.*3/)).toBeTruthy();
      });

      // Score should increase
      expect(screen.getByText(/Score.*2/) || screen.getByText(/2/)).toBeTruthy();
    });
  });

  describe('Game Over Scenarios', () => {
    test('handles game over when lives reach zero', async () => {
      const authValue = createMockAuthContext({ 
        id: 'user123', 
        username: 'testuser' 
      });

      mockApi.post
        .mockResolvedValueOnce({
          data: { initials: 'NN', round: 1, lives: 1 }
        })
        .mockResolvedValueOnce({
          data: { 
            correct: false, 
            round: 1, 
            lives: 0, 
            score: 3,
            game_over: true,
            final_score: 3,
            rating_change: -8.5,
            new_rating: 1191.5
          }
        })
        .mockResolvedValueOnce({
          data: {
            old_rating: 1200.0,
            new_rating: 1191.5,
            rating_change: -8.5,
            tier: { tier: 'Intermediate', color: '#C0C0C0' },
            games_played: 1
          }
        });

      render(
        <TestWrapper authValue={authValue}>
          <SurvivalScreen route={mockRoute} navigation={mockNavigation} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('NN')).toBeTruthy();
      });

      // Make final wrong guess
      const input = screen.getByPlaceholderText(/Enter player name/i);
      fireEvent.changeText(input, 'Wrong Player');
      
      const submitButton = screen.getByText(/Submit/i) || screen.getByText(/Guess/i);
      fireEvent.press(submitButton);

      // Should trigger game over and result submission
      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith(
          '/football/survival/complete',
          expect.objectContaining({
            user_id: 'user123',
            score: 3,
            duration_seconds: expect.any(Number)
          })
        );
      });

      // Should navigate to results
      expect(mockNavigate).toHaveBeenCalledWith('SurvivalResult', {
        sport: 'football',
        finalScore: 3,
        eloData: {
          old_rating: 1200.0,
          new_rating: 1191.5,
          rating_change: -8.5,
          tier: { tier: 'Intermediate', color: '#C0C0C0' },
          games_played: 1
        }
      });
    });

    test('handles voluntary game quit', async () => {
      const authValue = createMockAuthContext({ 
        id: 'user123', 
        username: 'testuser' 
      });

      mockApi.post
        .mockResolvedValueOnce({
          data: { initials: 'RM', round: 5, lives: 2 }
        })
        .mockResolvedValueOnce({
          data: {
            old_rating: 1200.0,
            new_rating: 1210.0,
            rating_change: 10.0,
            tier: { tier: 'Intermediate', color: '#C0C0C0' },
            games_played: 1
          }
        });

      render(
        <TestWrapper authValue={authValue}>
          <SurvivalScreen route={mockRoute} navigation={mockNavigation} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('RM')).toBeTruthy();
      });

      // Find and press quit button
      const quitButton = screen.getByText(/Quit/i) || screen.getByText(/End Game/i);
      fireEvent.press(quitButton);

      // Should submit results
      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith(
          '/football/survival/complete',
          expect.objectContaining({
            user_id: 'user123',
            score: 4, // Round 5 means 4 correct answers
            duration_seconds: expect.any(Number)
          })
        );
      });

      // Should navigate to results
      expect(mockNavigate).toHaveBeenCalledWith('SurvivalResult', {
        sport: 'football',
        finalScore: 4,
        eloData: {
          old_rating: 1200.0,
          new_rating: 1210.0,
          rating_change: 10.0,
          tier: { tier: 'Intermediate', color: '#C0C0C0' },
          games_played: 1
        }
      });
    });
  });

  describe('Result Submission', () => {
    test('submits survival results for authenticated user', async () => {
      const authValue = createMockAuthContext({ 
        id: 'user456', 
        username: 'survivalplayer' 
      });

      mockApi.post
        .mockResolvedValueOnce({
          data: { initials: 'MB', round: 1, lives: 1 }
        })
        .mockResolvedValueOnce({
          data: { 
            correct: false,
            lives: 0,
            score: 8,
            game_over: true
          }
        })
        .mockResolvedValueOnce({
          data: {
            old_rating: 1300.0,
            new_rating: 1315.0,
            rating_change: 15.0,
            tier: { tier: 'Expert', color: '#FFD700' },
            games_played: 5
          }
        });

      render(
        <TestWrapper authValue={authValue}>
          <SurvivalScreen route={mockRoute} navigation={mockNavigation} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('MB')).toBeTruthy();
      });

      // Trigger game over
      const input = screen.getByPlaceholderText(/Enter player name/i);
      fireEvent.changeText(input, 'Wrong Name');
      
      const submitButton = screen.getByText(/Submit/i) || screen.getByText(/Guess/i);
      fireEvent.press(submitButton);

      // Verify correct result submission
      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith(
          '/football/survival/complete',
          expect.objectContaining({
            user_id: 'user456',
            score: 8,
            duration_seconds: expect.any(Number)
          })
        );
      });
    });

    test('submits survival results for guest user', async () => {
      const authValue = createMockAuthContext(null); // Guest user

      mockApi.post
        .mockResolvedValueOnce({
          data: { initials: 'PD', round: 1, lives: 1 }
        })
        .mockResolvedValueOnce({
          data: { 
            correct: false,
            lives: 0,
            score: 5,
            game_over: true
          }
        })
        .mockResolvedValueOnce({
          data: {
            old_rating: 1200.0,
            new_rating: 1200.0,
            rating_change: 0,
            tier: { tier: 'Intermediate', color: '#C0C0C0' },
            games_played: 1
          }
        });

      render(
        <TestWrapper authValue={authValue}>
          <SurvivalScreen route={mockRoute} navigation={mockNavigation} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('PD')).toBeTruthy();
      });

      // Trigger game over
      const input = screen.getByPlaceholderText(/Enter player name/i);
      fireEvent.changeText(input, 'Wrong Name');
      
      const submitButton = screen.getByText(/Submit/i) || screen.getByText(/Guess/i);
      fireEvent.press(submitButton);

      // Should submit with guest ID
      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith(
          '/football/survival/complete',
          expect.objectContaining({
            user_id: expect.stringMatching(/^guest_/),
            score: 5
          })
        );
      });
    });

    test('calculates game duration correctly', async () => {
      const authValue = createMockAuthContext({ 
        id: 'user123', 
        username: 'testuser' 
      });

      // Mock Date.now for consistent timing
      const mockNow = jest.spyOn(Date, 'now');
      const startTime = 1000000;
      const endTime = startTime + 120000; // 2 minutes later
      
      mockNow
        .mockReturnValueOnce(startTime) // Game start
        .mockReturnValue(endTime); // Game end

      mockApi.post
        .mockResolvedValueOnce({
          data: { initials: 'TT', round: 1, lives: 1 }
        })
        .mockResolvedValueOnce({
          data: { 
            correct: false,
            lives: 0,
            score: 2,
            game_over: true
          }
        })
        .mockResolvedValueOnce({
          data: {
            old_rating: 1200.0,
            new_rating: 1195.0,
            rating_change: -5.0,
            tier: { tier: 'Intermediate', color: '#C0C0C0' },
            games_played: 1
          }
        });

      render(
        <TestWrapper authValue={authValue}>
          <SurvivalScreen route={mockRoute} navigation={mockNavigation} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('TT')).toBeTruthy();
      });

      // Trigger game over
      const input = screen.getByPlaceholderText(/Enter player name/i);
      fireEvent.changeText(input, 'Wrong Name');
      
      const submitButton = screen.getByText(/Submit/i) || screen.getByText(/Guess/i);
      fireEvent.press(submitButton);

      // Should calculate duration as 120 seconds
      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith(
          '/football/survival/complete',
          expect.objectContaining({
            user_id: 'user123',
            duration_seconds: 120
          })
        );
      });

      mockNow.mockRestore();
    });

    test('handles result submission failure gracefully', async () => {
      const authValue = createMockAuthContext({ 
        id: 'user123', 
        username: 'testuser' 
      });

      mockApi.post
        .mockResolvedValueOnce({
          data: { initials: 'FF', round: 1, lives: 1 }
        })
        .mockResolvedValueOnce({
          data: { 
            correct: false,
            lives: 0,
            score: 6,
            game_over: true
          }
        })
        .mockRejectedValueOnce(new Error('Network failure')); // Submission fails

      render(
        <TestWrapper authValue={authValue}>
          <SurvivalScreen route={mockRoute} navigation={mockNavigation} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('FF')).toBeTruthy();
      });

      // Trigger game over
      const input = screen.getByPlaceholderText(/Enter player name/i);
      fireEvent.changeText(input, 'Wrong Name');
      
      const submitButton = screen.getByText(/Submit/i) || screen.getByText(/Guess/i);
      fireEvent.press(submitButton);

      // Should still navigate to results even with submission failure
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('SurvivalResult', {
          sport: 'football',
          finalScore: 6,
          eloData: null // No ELO data due to failure
        });
      });
    });
  });

  describe('Error Handling', () => {
    test('handles API error during game start', async () => {
      const authValue = createMockAuthContext({ 
        id: 'user123', 
        username: 'testuser' 
      });

      mockApi.post.mockRejectedValueOnce(new Error('Start game failed'));

      render(
        <TestWrapper authValue={authValue}>
          <SurvivalScreen route={mockRoute} navigation={mockNavigation} />
        </TestWrapper>
      );

      // Should show error state
      await waitFor(() => {
        expect(screen.getByText(/Error/i) || screen.getByText(/Failed/i)).toBeTruthy();
      });
    });

    test('handles API error during guess submission', async () => {
      const authValue = createMockAuthContext({ 
        id: 'user123', 
        username: 'testuser' 
      });

      mockApi.post
        .mockResolvedValueOnce({
          data: { initials: 'ER', round: 1, lives: 3 }
        })
        .mockRejectedValueOnce(new Error('Guess submission failed'));

      render(
        <TestWrapper authValue={authValue}>
          <SurvivalScreen route={mockRoute} navigation={mockNavigation} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('ER')).toBeTruthy();
      });

      // Try to make a guess
      const input = screen.getByPlaceholderText(/Enter player name/i);
      fireEvent.changeText(input, 'Some Player');
      
      const submitButton = screen.getByText(/Submit/i) || screen.getByText(/Guess/i);
      fireEvent.press(submitButton);

      // Should handle error gracefully
      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith(
          '/football/survival/guess',
          { player_name: 'Some Player' }
        );
      });
    });
  });

  describe('Different Sports', () => {
    test('handles tennis survival game', async () => {
      const authValue = createMockAuthContext({ 
        id: 'user123', 
        username: 'testuser' 
      });

      const tennisRoute = {
        params: {
          sport: 'tennis'
        }
      };

      render(
        <TestWrapper authValue={authValue}>
          <SurvivalScreen route={tennisRoute} navigation={mockNavigation} />
        </TestWrapper>
      );

      // Should call tennis endpoints
      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith('/tennis/survival/start');
      });
    });
  });
});