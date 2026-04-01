import { Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import CrowdDetection from './pages/CrowdDetection';
import MissingPerson from './pages/MissingPerson';
import Layout from './components/Layout';
import { AppProvider } from './context/AppContext';
import { TranslationProvider } from './context/TranslationContext';

function App() {
    return (
        <AppProvider>
            <TranslationProvider>
                <Layout>
                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/crowd" element={<CrowdDetection />} />
                        <Route path="/missing-person" element={<MissingPerson />} />
                    </Routes>
                </Layout>
            </TranslationProvider>
        </AppProvider>
    );
}

export default App;
