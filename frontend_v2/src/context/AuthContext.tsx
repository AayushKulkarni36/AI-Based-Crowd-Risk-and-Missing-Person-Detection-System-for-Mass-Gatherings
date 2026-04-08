import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface AuthUser {
    id: string;
    email: string;
    full_name: string;
    role: 'ADMIN' | 'OPERATOR' | 'USER';
    created_at?: string;
    last_login?: string;
}

interface AuthContextType {
    user: AuthUser | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<{ role: string }>;
    signup: (fullName: string, email: string, password: string, confirmPassword: string) => Promise<void>;
    logout: () => void;
    changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const USER_STORAGE_KEY = 'authUser';

    // ── Validate token on app load ───────────────────────────────────────
    useEffect(() => {
        const token = localStorage.getItem('authToken');
        const cachedUser = localStorage.getItem(USER_STORAGE_KEY);
        if (cachedUser) {
            try {
                setUser(JSON.parse(cachedUser));
            } catch (_) {
                localStorage.removeItem(USER_STORAGE_KEY);
            }
        }
        if (token) {
            validateToken(token);
        } else {
            setIsLoading(false);
        }
    }, []);

    // ── Auto-refresh token every 6 hours ─────────────────────────────────
    // This prevents sudden logouts when the 8h (prod) token nears expiry.
    useEffect(() => {
        const SIX_HOURS = 6 * 60 * 60 * 1000;

        const interval = setInterval(async () => {
            const token = localStorage.getItem('authToken');
            if (!token) return; // Not logged in, nothing to refresh

            try {
                const res = await axios.post(
                    `${API_URL}/auth/refresh`,
                    {},
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const newToken = res.data?.token;
                if (newToken) {
                    localStorage.setItem('authToken', newToken);
                }
            } catch (err: any) {
                // Only force-logout if server explicitly rejects the token
                if (err?.response?.status === 401) {
                    localStorage.removeItem('authToken');
                    localStorage.removeItem(USER_STORAGE_KEY);
                    setUser(null);
                }
                // Network errors / server restarts → keep session, retry next cycle
            }
        }, SIX_HOURS);

        return () => clearInterval(interval);
    }, []);

    const validateToken = async (token: string) => {
        try {
            const response = await axios.get(`${API_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` },
                // Short timeout so a slow server on startup doesn't stall the app
                timeout: 8000
            });

            if (response.data && response.data.user) {
                setUser(response.data.user);
                localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.data.user));
            } else if (response.data) {
                setUser(response.data);
                localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.data));
            }
        } catch (error: any) {
            const status = error?.response?.status;

            // ONLY clear auth on a genuine "token rejected" response (401/403).
            // Network errors, server restarts, 5xx, timeouts → keep the session.
            // The user didn't do anything wrong; connectivity will recover.
            if (status === 401 || status === 403) {
                localStorage.removeItem('authToken');
                localStorage.removeItem(USER_STORAGE_KEY);
                setUser(null);
            }
            // All other errors: silently keep existing cached user from localStorage
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (email: string, password: string): Promise<{ role: string }> => {
        try {
            const response = await axios.post(`${API_URL}/auth/login`, {
                email,
                password
            });

            if (!response.data || !response.data.success) {
                throw new Error(response.data?.error || 'Login failed');
            }

            const { token, user: userData } = response.data;

            if (!token) {
                throw new Error('No token received from server');
            }

            localStorage.setItem('authToken', token);

            if (userData) {
                setUser(userData);
                localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
                return { role: userData.role };
            }

            throw new Error('No user data received');
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || error.message || 'Login failed';
            throw new Error(errorMessage);
        }
    };

    const signup = async (
        fullName: string,
        email: string,
        password: string,
        confirmPassword: string
    ): Promise<void> => {
        try {
            const response = await axios.post(`${API_URL}/auth/signup`, {
                name: fullName,
                email,
                password,
                confirmPassword
            });

            if (!response.data || !response.data.success) {
                throw new Error(response.data?.error || 'Signup failed');
            }

            const { token, user: userData } = response.data;

            if (!token) {
                throw new Error('No token received from server');
            }

            localStorage.setItem('authToken', token);

            if (userData) {
                setUser(userData);
                localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
            } else {
                throw new Error('No user data received');
            }
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || error.message || 'Signup failed';
            throw new Error(errorMessage);
        }
    };

    const changePassword = async (
        currentPassword: string,
        newPassword: string
    ): Promise<void> => {
        try {
            const token = localStorage.getItem('authToken');

            if (!token) {
                throw new Error('Not authenticated');
            }

            const response = await axios.post(
                `${API_URL}/auth/change-password`,
                {
                    currentPassword,
                    newPassword,
                    confirmNewPassword: newPassword
                },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            if (!response.data || !response.data.success) {
                throw new Error(response.data?.error || 'Failed to change password');
            }
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || error.message || 'Failed to change password';
            throw new Error(errorMessage);
        }
    };

    const logout = () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem(USER_STORAGE_KEY);
        setUser(null);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                isAuthenticated: !!user,
                login,
                signup,
                logout,
                changePassword
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export default AuthContext;
