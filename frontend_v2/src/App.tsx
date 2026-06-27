import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Auth Pages
import { LoginPage } from './pages/auth/LoginPage';
import { SignupPage } from './pages/auth/SignupPage';
import { AdminLoginPage } from './pages/auth/AdminLoginPage';

// Protected Pages
import Dashboard from './pages/Dashboard';
import CrowdDetection from './pages/CrowdDetection';
import MissingPersons from './pages/MissingPersons';
import Alerts from './pages/Alerts';

// Components
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// Context
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { TranslationProvider } from './context/TranslationContext';
import { SocketProvider } from './context/SocketContext';

// UI
import { Toaster } from 'sonner';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5,
            gcTime: 1000 * 60 * 10,
        },
    },
});

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <SocketProvider>
                    <AppProvider>
                        <TranslationProvider>
                            <Routes>
                                {/* Public Auth Routes */}
                                <Route path="/login" element={<LoginPage />} />
                                <Route path="/signup" element={<SignupPage />} />
                                <Route path="/admin/login" element={<AdminLoginPage />} />

                                {/* Protected Routes */}
                                <Route
                                    path="/*"
                                    element={
                                        <ProtectedRoute>
                                            <Layout>
                                                <Routes>
                                                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                                                    <Route path="/dashboard" element={<Dashboard />} />
                                                    <Route path="/crowd" element={<CrowdDetection />} />
                                                    <Route path="/missing-persons" element={<MissingPersons />} />
                                                    <Route path="/alerts" element={<Alerts />} />

                                                    {/* 404 */}
                                                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                                                </Routes>
                                            </Layout>
                                        </ProtectedRoute>
                                    }
                                />
                            </Routes>

                            <Toaster position="bottom-right" theme="dark" />
                        </TranslationProvider>
                    </AppProvider>
                </SocketProvider>
            </AuthProvider>
        </QueryClientProvider>
    );
}

export default App;
