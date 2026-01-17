import api, { setAuthToken, getAuthToken } from '../lib/api';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export const authService = {
  // Sign up a new user
  async signUp(email: string, password: string, name: string, role: string = 'Staff') {
    const response = await api.auth.register(email, password, name, role);

    if (response.token) {
      setAuthToken(response.token);
    }

    return {
      user: response.user,
      session: { access_token: response.token }
    };
  },

  // Sign in an existing user
  async signIn(email: string, password: string) {
    const response = await api.auth.login(email, password);

    if (response.token) {
      setAuthToken(response.token);
    }

    return {
      user: response.user,
      session: { access_token: response.token }
    };
  },

  // Sign out the current user
  async signOut() {
    setAuthToken(null);
  },

  // Get the current session
  async getSession() {
    const token = getAuthToken();
    if (!token) return null;

    try {
      const response = await api.auth.getMe();
      return { access_token: token, user: response.user };
    } catch (error) {
      setAuthToken(null);
      return null;
    }
  },

  // Get the current user
  async getCurrentUser() {
    const token = getAuthToken();
    if (!token) return null;

    try {
      const response = await api.auth.getMe();
      return response.user;
    } catch (error) {
      setAuthToken(null);
      return null;
    }
  },

  // Transform API user to AuthUser (for compatibility)
  transformUser(user: any): AuthUser | null {
    if (!user) return null;

    return {
      id: user.id,
      email: user.email || '',
      name: user.name || user.email?.split('@')[0] || 'User',
      role: user.role || 'Staff',
    };
  },

  // Listen to auth state changes (simplified for JWT-based auth)
  onAuthStateChange(callback: (user: AuthUser | null) => void) {
    // Check initial state
    this.getCurrentUser().then(user => {
      callback(this.transformUser(user));
    });

    // Return unsubscribe function
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            // No-op for JWT auth
          }
        }
      }
    };
  },
};
