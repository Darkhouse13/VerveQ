/**
 * Tests for AuthContext
 * Tests authentication state management, API calls, and token handling
 */
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from '../../../frontend/src/context/AuthContext';
import { API_URL } from '../../../frontend/src/config/api';

// Helper to render hook with provider
const renderAuthHook = () => {
  return renderHook(() => useAuth(), {
    wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
  });
};

describe('AuthContext', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  describe('Initial State', () => {
    it('should initialize with default values', () => {
      const { result } = renderAuthHook();

      expect(result.current.user).toBeNull();
      expect(result.current.loading).toBe(true);
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should load stored token on mount', async () => {
      const mockToken = 'stored-token-123';
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
      };

      AsyncStorage.getItem.mockResolvedValueOnce(mockToken);
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      });

      const { result } = renderAuthHook();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.user).toEqual(mockUser);
        expect(result.current.isAuthenticated).toBe(true);
      });

      expect(AsyncStorage.getItem).toHaveBeenCalledWith('userToken');
      expect(global.fetch).toHaveBeenCalledWith(
        `${API_URL}/auth/me`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
          }),
        })
      );
    });
  });

  describe('Login', () => {
    it('should login user successfully', async () => {
      const mockToken = 'new-token-456';
      const mockUser = {
        id: 'user-456',
        username: 'loginuser',
        email: 'login@example.com',
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: mockToken,
          user: mockUser,
        }),
      });

      const { result } = renderAuthHook();

      await act(async () => {
        await result.current.login('loginuser');
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('userToken', mockToken);
      expect(global.fetch).toHaveBeenCalledWith(
        `${API_URL}/auth/login`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ username: 'loginuser' }),
        })
      );
    });

    it('should handle login failure', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ detail: 'User not found' }),
      });

      const { result } = renderAuthHook();

      await act(async () => {
        try {
          await result.current.login('nonexistent');
        } catch (error) {
          expect(error.message).toBe('User not found');
        }
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it('should handle network error during login', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderAuthHook();

      await act(async () => {
        try {
          await result.current.login('testuser');
        } catch (error) {
          expect(error.message).toBe('Network error');
        }
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('Logout', () => {
    it('should logout user successfully', async () => {
      // Setup authenticated state
      const mockToken = 'token-789';
      const mockUser = { id: 'user-789', username: 'logoutuser' };

      AsyncStorage.getItem.mockResolvedValueOnce(mockToken);
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      });

      const { result } = renderAuthHook();

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      // Perform logout
      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('userToken');
    });
  });

  describe('Create User', () => {
    it('should create user with email successfully', async () => {
      const newUser = {
        id: 'new-user-123',
        username: 'newuser',
        email: 'new@example.com',
        is_guest: false,
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => newUser,
      });

      const { result } = renderAuthHook();

      let createdUser;
      await act(async () => {
        createdUser = await result.current.createUser('newuser', 'new@example.com');
      });

      expect(createdUser).toEqual(newUser);
      expect(global.fetch).toHaveBeenCalledWith(
        `${API_URL}/auth/users`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            username: 'newuser',
            email: 'new@example.com',
          }),
        })
      );
    });

    it('should create user without email successfully', async () => {
      const newUser = {
        id: 'new-user-456',
        username: 'noemailuser',
        email: null,
        is_guest: false,
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => newUser,
      });

      const { result } = renderAuthHook();

      let createdUser;
      await act(async () => {
        createdUser = await result.current.createUser('noemailuser');
      });

      expect(createdUser).toEqual(newUser);
      expect(createdUser.email).toBeNull();
    });

    it('should handle duplicate username error', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ detail: 'Username already exists' }),
      });

      const { result } = renderAuthHook();

      await act(async () => {
        try {
          await result.current.createUser('duplicate');
        } catch (error) {
          expect(error.message).toBe('Username already exists');
        }
      });
    });
  });

  describe('Guest Session', () => {
    it('should create guest session successfully', async () => {
      const mockSessionId = 'guest-session-123';
      const mockToken = 'guest-token-123';
      const mockGuestUser = {
        id: mockSessionId,
        username: 'guest_abc123',
        is_guest: true,
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: mockSessionId,
          access_token: mockToken,
          user: mockGuestUser,
        }),
      });

      const { result } = renderAuthHook();

      await act(async () => {
        await result.current.createGuestSession();
      });

      expect(result.current.user).toEqual(mockGuestUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('userToken', mockToken);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('guestSessionId', mockSessionId);
    });
  });

  describe('API Call Wrapper', () => {
    it('should make authenticated API calls', async () => {
      // Setup authenticated state
      const mockToken = 'api-token-123';
      const mockUser = { id: 'api-user', username: 'apiuser' };

      AsyncStorage.getItem.mockResolvedValueOnce(mockToken);
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUser,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: 'test' }),
        });

      const { result } = renderAuthHook();

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      // Make API call
      let response;
      await act(async () => {
        response = await result.current.apiCall('/test-endpoint');
      });

      expect(response).toEqual({ data: 'test' });
      expect(global.fetch).toHaveBeenLastCalledWith(
        `${API_URL}/test-endpoint`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
          }),
        })
      );
    });

    it('should handle 401 errors by logging out', async () => {
      // Setup authenticated state
      const mockToken = 'expired-token';
      const mockUser = { id: 'user-401', username: 'expireduser' };

      AsyncStorage.getItem.mockResolvedValueOnce(mockToken);
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUser,
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ detail: 'Token expired' }),
        });

      const { result } = renderAuthHook();

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      // Make API call that returns 401
      await act(async () => {
        try {
          await result.current.apiCall('/protected-endpoint');
        } catch (error) {
          expect(error.message).toBe('Token expired');
        }
      });

      // Should have logged out
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('userToken');
    });

    it('should support different HTTP methods', async () => {
      const mockToken = 'method-token';
      AsyncStorage.getItem.mockResolvedValueOnce(mockToken);

      const { result } = renderAuthHook();

      // Wait for auth to initialize
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await act(async () => {
        await result.current.apiCall('/test', {
          method: 'POST',
          body: JSON.stringify({ data: 'test' }),
        });
      });

      expect(global.fetch).toHaveBeenLastCalledWith(
        `${API_URL}/test`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ data: 'test' }),
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
          }),
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed token gracefully', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce('malformed-token');
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Invalid token' }),
      });

      const { result } = renderAuthHook();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.user).toBeNull();
        expect(result.current.isAuthenticated).toBe(false);
      });
    });

    it('should handle AsyncStorage errors', async () => {
      AsyncStorage.getItem.mockRejectedValueOnce(new Error('Storage error'));

      const { result } = renderAuthHook();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.user).toBeNull();
        expect(result.current.isAuthenticated).toBe(false);
      });
    });
  });
});