import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthContextType, AuthState, User } from '../types/auth';
import * as authService from '../services/authService';

// Create context with undefined as default (will be set by provider)
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Initial state as specified
const initialState: AuthState = {
  user: null,
  loading: true,
  error: null,
  initialized: false,
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, setState] = useState<AuthState>(initialState);

  // Clear error action
  const clearError = () => {
    setState((prev) => ({ ...prev, error: null }));
  };

  // Sign up action
  const signUp = async (email: string, password: string): Promise<void> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const user = await authService.signUp(email, password);
      setState((prev) => ({ ...prev, user, loading: false, error: null }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign up failed';
      setState((prev) => ({ ...prev, loading: false, error: message }));
      throw error;
    }
  };

  // Sign in action
  const signIn = async (email: string, password: string): Promise<void> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const user = await authService.signIn(email, password);
      setState((prev) => ({ ...prev, user, loading: false, error: null }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign in failed';
      setState((prev) => ({ ...prev, loading: false, error: message }));
      throw error;
    }
  };

  // Sign in anonymously action
  const signInAnonymously = async (): Promise<void> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const user = await authService.signInAnonymously();
      setState((prev) => ({ ...prev, user, loading: false, error: null }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Anonymous sign in failed';
      setState((prev) => ({ ...prev, loading: false, error: message }));
      throw error;
    }
  };

  // Sign out action
  const signOut = async (): Promise<void> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      await authService.signOut();
      setState((prev) => ({ ...prev, user: null, loading: false, error: null }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign out failed';
      setState((prev) => ({ ...prev, loading: false, error: message }));
      throw error;
    }
  };

  // Reset password action
  const resetPassword = async (email: string): Promise<void> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      await authService.resetPassword(email);
      setState((prev) => ({ ...prev, loading: false, error: null }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Reset password failed';
      setState((prev) => ({ ...prev, loading: false, error: message }));
      throw error;
    }
  };

  // Update profile action
  const updateProfile = async (displayName?: string, photoURL?: string): Promise<void> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      await authService.updateUserProfile(displayName, photoURL);
      // Update local state with new profile values
      setState((prev) => ({
        ...prev,
        user: prev.user
          ? {
              ...prev.user,
              displayName: displayName ?? prev.user.displayName,
              photoURL: photoURL ?? prev.user.photoURL,
            }
          : null,
        loading: false,
        error: null,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Update profile failed';
      setState((prev) => ({ ...prev, loading: false, error: message }));
      throw error;
    }
  };

  // Refresh user data from Firebase
  const refreshUser = async (): Promise<void> => {
    try {
      const currentUser = authService.auth?.currentUser;
      if (currentUser) {
        await currentUser.reload();
        const refreshedUser = authService.mapFirebaseUserToUser ?
          authService.mapFirebaseUserToUser(currentUser) :
          {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
            phoneNumber: currentUser.phoneNumber,
            isAnonymous: currentUser.isAnonymous,
            createdAt: new Date(currentUser.metadata.creationTime || Date.now()),
            lastLoginAt: new Date(currentUser.metadata.lastSignInTime || Date.now()),
          };
        setState((prev) => ({ ...prev, user: refreshedUser }));
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  // Initialize auth state - this runs once on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const unsubscribe = authService.subscribeToAuthChanges((user) => {
          setState({ user, loading: false, error: null, initialized: true });
        });
        return unsubscribe;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Auth initialization failed';
        setState((prev) => ({ ...prev, loading: false, error: message, initialized: true }));
      }
    };

    const unsubscribePromise = initializeAuth();

    return () => {
      unsubscribePromise.then((unsubscribe) => {
        if (unsubscribe) {
          unsubscribe();
        }
      });
    };
  }, []);

  const value: AuthContextType = {
    ...state,
    signUp,
    signIn,
    signInAnonymously,
    signOut,
    resetPassword,
    updateProfile,
    clearError,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook for consuming auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export { AuthContext };