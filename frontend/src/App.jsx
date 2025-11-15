import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import VideoAnalysis from './pages/VideoAnalysis.jsx';
import MissingPersons from './pages/MissingPersons.jsx';
import Statistics from './pages/Statistics.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen pb-10 bg-slate-900">
        <Navbar />
        <div className="container mx-auto px-6 pt-24">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/video-analysis" element={<VideoAnalysis />} />
            <Route path="/missing-persons" element={<MissingPersons />} />
            <Route path="/statistics" element={<Statistics />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
