import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CrowdDetection from './pages/CrowdDetection';
import MissingPersons from './pages/MissingPersons';
import Alerts from './pages/Alerts';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { TranslationProvider } from './context/TranslationContext';
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
                <AppProvider>
                    <TranslationProvider>
                        <Routes>
                            <Route path="/login" element={<Login />} />
                            <Route
                                path="/*"
                                element={
                                    <ProtectedRoute>
                                        <Layout>
                                            <Routes>
                                                <Route path="/" element={<Dashboard />} />
                                                <Route path="/crowd" element={<CrowdDetection />} />
                                                <Route path="/missing-persons" element={<MissingPersons />} />
                                                <Route path="/alerts" element={<Alerts />} />
                                                <Route path="*" element={<Navigate to="/" replace />} />
                                            </Routes>
                                        </Layout>
                                    </ProtectedRoute>
                                }
                            />
                        </Routes>
                        <Toaster position="bottom-right" theme="dark" />
                    </TranslationProvider>
                </AppProvider>
            </AuthProvider>
        </QueryClientProvider>
    );
}

export default App;
