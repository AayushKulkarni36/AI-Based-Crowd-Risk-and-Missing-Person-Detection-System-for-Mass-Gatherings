import { Link, useLocation } from 'react-router-dom';
import { Home, Video, Users, BarChart3, Brain } from 'lucide-react';

export default function Navbar() {
  const location = useLocation();
  
  const isActive = (path) => location.pathname === path;
  
  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/video-analysis', icon: Video, label: 'Video Analysis' },
    { path: '/missing-persons', icon: Users, label: 'Missing Persons' },
    { path: '/statistics', icon: BarChart3, label: 'Statistics' }
  ];
  
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-800">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg group-hover:shadow-blue-500/50 transition-all duration-300">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">CrowdGuard AI</h1>
              <p className="text-xs text-slate-400">Intelligent Safety Management</p>
            </div>
          </Link>
          
          {/* Navigation Links */}
          <div className="flex items-center space-x-1">
            {navItems.map(({ path, icon: Icon, label }) => (
              <Link
                key={path}
                to={path}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-300 ${
                  isActive(path)
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium text-sm">{label}</span>
              </Link>
            ))}
          </div>
          
          {/* User Profile (Optional) */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-gradient-to-br from-slate-700 to-slate-800 rounded-full flex items-center justify-center border border-slate-600">
              <span className="text-sm font-semibold text-white">AI</span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
