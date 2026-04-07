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

    // Validate token on app load
    useEffect(() => {
        const token = localStorage.getItem('authToken');
        if (token) {
            validateToken(token);
        } else {
            setIsLoading(false);
        }
    }, []);

    const validateToken = async (token: string) => {
        try {
            const response = await axios.get(`${API_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data && response.data.user) {
                setUser(response.data.user);
            } else if (response.data) {
                // User data directly in response
                setUser(response.data);
            }
        } catch (error) {
            localStorage.removeItem('authToken');
            setUser(null);
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
