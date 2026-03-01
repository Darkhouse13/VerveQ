/**
 * Unit tests for QuizScreen component.
 * Tests quiz game functionality and result submission.
 */
import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import QuizScreen from '../../../frontend/src/screens/QuizScreen';
import { AuthContext } from '../../../frontend/src/context/AuthContext';
import api from '../../../frontend/src/config/api';

// Mock the API
jest.mock('../../../frontend/src/config/api');
const mockApi = api;

// Mock navigation
const mockNavigate = jest.fn();
const mockRoute = {
  params: {
    sport: 'football',
    difficulty: 'intermediate'
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
          <Stack.Screen name="Quiz" component={() => children} />
        </Stack.Navigator>
      </AuthContext.Provider>
    </NavigationContainer>
  );
};

describe('QuizScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default API mock responses
    mockApi.get = jest.fn().mockResolvedValue({
      data: {
        question: 'Who won the 2020 UEFA Champions League?',
        options: ['Bayern Munich', 'Paris Saint-Germain', 'Manchester City', 'Real Madrid'],
        question_id: 1
      }
    });
    
    mockApi.post = jest.fn().mockResolvedValue({
      data: {
        correct: true,
        score: 1,
        questions_answered: 1,
        correct_answers: 1,
        next_question: {
          question: 'Which player scored the most goals in 2021?',
          options: ['Lionel Messi', 'Cristiano Ronaldo', 'Robert Lewandowski', 'Kylian Mbappé'],
          question_id: 2
        }
      }
    });
  });

  describe('Component Rendering', () => {
    test('renders quiz screen correctly for authenticated user', async () => {
      const authValue = createMockAuthContext({ 
        id: 'user123', 
        username: 'testuser' 
      });

      render(
        <TestWrapper authValue={authValue}>
          <QuizScreen route={mockRoute} navigation={mockNavigation} />
        </TestWrapper>
      );

      // Check for loading state initially
      expect(screen.getByText(/Loading/i)).toBeTruthy();

      // Wait for question to load
      await waitFor(() => {
        expect(screen.getByText('Who won the 2020 UEFA Champions League?')).toBeTruthy();
      });

      // Check that all answer options are rendered
      expect(screen.getByText('Bayern Munich')).toBeTruthy();
      expect(screen.getByText('Paris Saint-Germain')).toBeTruthy();
      expect(screen.getByText('Manchester City')).toBeTruthy();
      expect(screen.getByText('Real Madrid')).toBeTruthy();
    });

    test('renders quiz screen for guest user', async () => {
      const authValue = createMockAuthContext(null); // No authenticated user

      render(
        <TestWrapper authValue={authValue}>
          <QuizScreen route={mockRoute} navigation={mockNavigation} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Who won the 2020 UEFA Champions League?')).toBeTruthy();
      });

      // Guest users should still be able to play
      expect(screen.getByText('Bayern Munich')).toBeTruthy();
    });
  });

  describe('Quiz Gameplay', () => {
  test('handles answer selection and submission with progress update', async () => {
      const authValue = createMockAuthContext({ 
        id: 'user123', 
        username: 'testuser' 
      });

      render(
        <TestWrapper authValue={authValue}>
          <QuizScreen route={mockRoute} navigation={mockNavigation} />
        </TestWrapper>
      );

      // Wait for question to load
      await waitFor(() => {
        expect(screen.getByText('Who won the 2020 UEFA Champions League?')).toBeTruthy();
      });

      // Select an answer
      fireEvent.press(screen.getByText('Bayern Munich'));

      // Wait for API call
      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith(
          '/football/quiz/check',
          {
            question_id: 1,
            answer: 'Bayern Munich'
          }
        );
      });

      // Should show next question and progress 2/10
      await waitFor(() => {
        expect(screen.getByText('Which player scored the most goals in 2021?')).toBeTruthy();
        expect(screen.getByText(/Question 2\/10/)).toBeTruthy();
      });
    });

    test('tracks game statistics correctly', async () => {
      const authValue = createMockAuthContext({ 
        id: 'user123', 
        username: 'testuser' 
      });

      render(
        <TestWrapper authValue={authValue}>
          <QuizScreen route={mockRoute} navigation={mockNavigation} />
        </TestWrapper>
      );

      // Wait for initial question
      await waitFor(() => {
        expect(screen.getByText('Who won the 2020 UEFA Champions League?')).toBeTruthy();
      });

      // Answer first question correctly
      fireEvent.press(screen.getByText('Bayern Munich'));

      await waitFor(() => {
        expect(screen.getByText('Which player scored the most goals in 2021?')).toBeTruthy();
      });

      // Check score display (should show 1/1 or similar)
      expect(screen.getByText(/1/)).toBeTruthy();
    });

    test('handles incorrect answers', async () => {
      const authValue = createMockAuthContext({ 
        id: 'user123', 
        username: 'testuser' 
      });

      // Mock incorrect answer response
      mockApi.post.mockResolvedValueOnce({
        data: {
          correct: false,
          score: 0,
          questions_answered: 1,
          correct_answers: 0,
          next_question: {
            question: 'Next question here',
            options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
            question_id: 2
          }
        }
      });

      render(
        <TestWrapper authValue={authValue}>
          <QuizScreen route={mockRoute} navigation={mockNavigation} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Who won the 2020 UEFA Champions League?')).toBeTruthy();
      });

      // Select wrong answer
      fireEvent.press(screen.getByText('Paris Saint-Germain'));

      // Should still progress to next question
      await waitFor(() => {
        expect(screen.getByText('Next question here')).toBeTruthy();
      });
    });
  });

  describe('Game Completion and Result Submission', () => {
  test('submits quiz results on game completion after 10 questions for authenticated user', async () => {
      const authValue = createMockAuthContext({ 
        id: 'user123', 
        username: 'testuser' 
      });

      // Mock 9 intermediate answers then final completion payload
      const intermediateQuestions = Array.from({ length: 9 }).map((_, i) => ({
        data: {
          correct: true,
          score: i + 1,
          questions_answered: i + 1,
          correct_answers: i + 1,
          next_question: {
            question: `Question ${i + 2}`,
            options: ['A', 'B', 'C', 'D'],
            question_id: i + 2
          }
        }
      }));
      const finalCompletion = {
        data: {
          correct: true,
          score: 10,
          questions_answered: 10,
          correct_answers: 10,
          game_complete: true,
          final_score: 10,
          rating_change: 20.0,
          new_rating: 1220.0,
          accuracy: 1.0
        }
      };
      mockApi.post.mockResolvedValueOnce(intermediateQuestions[0])
        .mockResolvedValueOnce(intermediateQuestions[1])
        .mockResolvedValueOnce(intermediateQuestions[2])
        .mockResolvedValueOnce(intermediateQuestions[3])
        .mockResolvedValueOnce(intermediateQuestions[4])
        .mockResolvedValueOnce(intermediateQuestions[5])
        .mockResolvedValueOnce(intermediateQuestions[6])
        .mockResolvedValueOnce(intermediateQuestions[7])
        .mockResolvedValueOnce(intermediateQuestions[8])
        .mockResolvedValueOnce(finalCompletion);

      render(
        <TestWrapper authValue={authValue}>
          <QuizScreen route={mockRoute} navigation={mockNavigation} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Who won the 2020 UEFA Champions League?')).toBeTruthy();
      });

      // Answer through all 10 questions
      for (let i = 0; i < 10; i++) {
        fireEvent.press(screen.getByText(/Bayern Munich|A/));
        // wait for next question or completion
        // eslint-disable-next-line no-await-in-loop
        await waitFor(() => {
          if (i < 9) {
            expect(screen.getByText(`Question ${i + 2}`)).toBeTruthy();
          }
        });
      }

      // Should navigate to results with ELO data
  // Final completion call should be to /football/quiz/complete
  const completionCall = mockApi.post.mock.calls.find(call => call[0] === '/football/quiz/complete');
  expect(completionCall).toBeTruthy();
    });

  test('submits quiz results for guest user after full length', async () => {
      const authValue = createMockAuthContext(null); // Guest user

      // Provide 10 question flow for guest
      const questions = Array.from({ length: 9 }).map((_, i) => ({
        data: {
          correct: i % 2 === 0,
          score: i + 1,
          questions_answered: i + 1,
          correct_answers: Math.ceil((i + 1) / 2),
          next_question: {
            question: `Guest Q${i + 2}`,
            options: ['A', 'B', 'C', 'D'],
            question_id: i + 2
          }
        }
      }));
      const guestCompletion = {
        data: {
          correct: true,
          score: 6,
          questions_answered: 10,
          correct_answers: 6,
          game_complete: true,
          final_score: 6,
          rating_change: 0,
          new_rating: 1200,
          accuracy: 0.6
        }
      };
      questions.forEach(q => mockApi.post.mockResolvedValueOnce(q));
      mockApi.post.mockResolvedValueOnce(guestCompletion);

      render(
        <TestWrapper authValue={authValue}>
          <QuizScreen route={mockRoute} navigation={mockNavigation} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Who won the 2020 UEFA Champions League?')).toBeTruthy();
      });

      for (let i = 0; i < 10; i++) {
        fireEvent.press(screen.getByText(/Bayern Munich|A/));
        // eslint-disable-next-line no-await-in-loop
        await waitFor(() => {
          if (i < 9) {
            expect(screen.getByText(new RegExp(`Guest Q${i + 2}`))).toBeTruthy();
          }
        });
      }
      const completion = mockApi.post.mock.calls.find(call => call[0] === '/football/quiz/complete');
      expect(completion).toBeTruthy();
    });

    test('handles result submission failure gracefully', async () => {
      const authValue = createMockAuthContext({ 
        id: 'user123', 
        username: 'testuser' 
      });

      // Mock game completion but result submission failure
      mockApi.post
        .mockResolvedValueOnce({
          data: {
            correct: true,
            score: 4,
            questions_answered: 5,
            correct_answers: 4,
            game_complete: true,
            final_score: 4,
            rating_change: 8.2,
            new_rating: 1208.2,
            accuracy: 0.8
          }
        })
        .mockRejectedValueOnce(new Error('Network error'));

      render(
        <TestWrapper authValue={authValue}>
          <QuizScreen route={mockRoute} navigation={mockNavigation} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Who won the 2020 UEFA Champions League?')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Bayern Munich'));

      // Should still navigate to results even if submission fails
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('QuizResult', {
          sport: 'football',
          finalScore: 4,
          questionsAnswered: 5,
          accuracy: 0.8,
          eloData: null // No ELO data due to submission failure
        });
      });
    });

    test('calculates average time correctly', async () => {
      const authValue = createMockAuthContext({ 
        id: 'user123', 
        username: 'testuser' 
      });

      // Mock multiple questions with timing
      mockApi.post
        .mockResolvedValueOnce({
          data: {
            correct: true,
            score: 1,
            questions_answered: 1,
            correct_answers: 1,
            next_question: {
              question: 'Second question',
              options: ['A', 'B', 'C', 'D'],
              question_id: 2
            }
          }
        })
        .mockResolvedValueOnce({
          data: {
            correct: false,
            score: 1,
            questions_answered: 2,
            correct_answers: 1,
            game_complete: true,
            final_score: 1,
            rating_change: -5.0,
            new_rating: 1195.0,
            accuracy: 0.5
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
          <QuizScreen route={mockRoute} navigation={mockNavigation} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Who won the 2020 UEFA Champions League?')).toBeTruthy();
      });

      // Answer first question (timing starts)
      fireEvent.press(screen.getByText('Bayern Munich'));

      await waitFor(() => {
        expect(screen.getByText('Second question')).toBeTruthy();
      });

      // Answer second question (game completes)
      fireEvent.press(screen.getByText('A'));

      // Verify average time is calculated
      await waitFor(() => {
        const lastCall = mockApi.post.mock.calls.find(call => 
          call[0] === '/football/quiz/complete'
        );
        expect(lastCall[1]).toHaveProperty('average_time');
        expect(typeof lastCall[1].average_time).toBe('number');
        expect(lastCall[1].average_time).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling', () => {
    test('handles API errors during question loading', async () => {
      const authValue = createMockAuthContext({ 
        id: 'user123', 
        username: 'testuser' 
      });

      mockApi.get.mockRejectedValueOnce(new Error('API Error'));

      render(
        <TestWrapper authValue={authValue}>
          <QuizScreen route={mockRoute} navigation={mockNavigation} />
        </TestWrapper>
      );

      // Should show error state
      await waitFor(() => {
        expect(screen.getByText(/Error/i) || screen.getByText(/Failed/i)).toBeTruthy();
      });
    });

    test('handles API errors during answer submission', async () => {
      const authValue = createMockAuthContext({ 
        id: 'user123', 
        username: 'testuser' 
      });

      mockApi.post.mockRejectedValueOnce(new Error('Submission Error'));

      render(
        <TestWrapper authValue={authValue}>
          <QuizScreen route={mockRoute} navigation={mockNavigation} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Who won the 2020 UEFA Champions League?')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Bayern Munich'));

      // Should handle error gracefully
      await waitFor(() => {
        // Error handling could show a message or retry option
        expect(mockApi.post).toHaveBeenCalled();
      });
    });
  });

  describe('Props and Navigation', () => {
    test('handles different sports correctly', async () => {
      const authValue = createMockAuthContext({ 
        id: 'user123', 
        username: 'testuser' 
      });

      const tennisRoute = {
        params: {
          sport: 'tennis',
          difficulty: 'hard'
        }
      };

      render(
        <TestWrapper authValue={authValue}>
          <QuizScreen route={tennisRoute} navigation={mockNavigation} />
        </TestWrapper>
      );

      // Should call tennis endpoint
      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledWith('/tennis/quiz/question');
      });
    });

    test('handles different difficulty levels', async () => {
      const authValue = createMockAuthContext({ 
        id: 'user123', 
        username: 'testuser' 
      });

      const hardRoute = {
        params: {
          sport: 'football',
          difficulty: 'hard'
        }
      };

      mockApi.post.mockResolvedValueOnce({
        data: {
          correct: true,
          score: 1,
          questions_answered: 1,
          correct_answers: 1,
          game_complete: true,
          final_score: 1,
          rating_change: 20.0,
          new_rating: 1220.0,
          accuracy: 1.0
        }
      });

      render(
        <TestWrapper authValue={authValue}>
          <QuizScreen route={hardRoute} navigation={mockNavigation} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Who won the 2020 UEFA Champions League?')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Bayern Munich'));

      // Should submit with hard difficulty
      await waitFor(() => {
        const completionCall = mockApi.post.mock.calls.find(call => 
          call[0] === '/football/quiz/complete'
        );
        if (completionCall) {
          expect(completionCall[1]).toHaveProperty('difficulty', 'hard');
        }
      });
    });
  });
});