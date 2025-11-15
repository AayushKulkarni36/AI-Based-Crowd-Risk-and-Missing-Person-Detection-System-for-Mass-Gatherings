import { useEffect, useState } from 'react';
import { Users, Video, AlertTriangle, TrendingUp, ArrowRight, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import StatCard from '../components/StatCard';
import { api } from '../services/api';

export default function Dashboard() {
  const [stats, setStats] = useState({
    activePersons: 0,
    totalDetections: 0,
    totalAlerts: 0
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const { data } = await api.getOverview();
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Section */}
      <div className="premium-card p-12">
        <div className="max-w-3xl">
          <h1 className="text-5xl font-bold text-white mb-4 leading-tight">
            AI-Based Crowd Risk <span className="text-blue-500">Detection System</span>
          </h1>
          <p className="text-xl text-slate-400 mb-8 leading-relaxed">
            Real-time crowd analysis and risk assessment powered by advanced artificial intelligence
            to ensure public safety and efficient crowd management.
          </p>
          <div className="flex items-center space-x-4">
            <Link to="/video-analysis" className="btn-premium flex items-center space-x-2">
              <Play className="w-5 h-5" />
              <span>Start Analysis</span>
            </Link>
            <button className="btn-secondary flex items-center space-x-2">
              <span>View Documentation</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Active Missing Persons"
          value={loading ? '--' : stats.activePersons}
          icon={Users}
          iconBg="from-rose-500 to-pink-600"
          trend="+3 from last week"
          trendUp={true}
        />
        <StatCard
          title="Total Detections"
          value={loading ? '--' : stats.totalDetections}
          icon={Video}
          iconBg="from-blue-500 to-cyan-600"
          trend="+12% this month"
          trendUp={true}
        />
        <StatCard
          title="Total Alerts"
          value={loading ? '--' : stats.totalAlerts}
          icon={AlertTriangle}
          iconBg="from-amber-500 to-orange-600"
          trend="-8% improvement"
          trendUp={false}
        />
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="premium-card p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Play className="w-4 h-4 text-white" />
            </div>
            <span>Quick Actions</span>
          </h2>
          <div className="space-y-3">
            <Link to="/video-analysis" className="block p-4 bg-slate-900/50 rounded-lg hover:bg-slate-800/50 transition-all group">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white group-hover:text-blue-400 transition-colors">Upload & Analyze Video</h3>
                  <p className="text-sm text-slate-400">Process video for crowd detection</p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
              </div>
            </Link>
            <Link to="/missing-persons" className="block p-4 bg-slate-900/50 rounded-lg hover:bg-slate-800/50 transition-all group">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white group-hover:text-blue-400 transition-colors">Manage Missing Persons</h3>
                  <p className="text-sm text-slate-400">Register and track missing person cases</p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
              </div>
            </Link>
          </div>
        </div>

        {/* System Status */}
        <div className="premium-card p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span>System Status</span>
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-slate-300">YOLOv5 Detection Engine</span>
              </div>
              <span className="badge-success">Active</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-slate-300">PostgreSQL Database</span>
              </div>
              <span className="badge-success">Connected</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                <span className="text-slate-300">Face Recognition Module</span>
              </div>
              <span className="badge-warning">In Development</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                <span className="text-slate-300">Real-time Alert System</span>
              </div>
              <span className="badge-warning">Coming Soon</span>
            </div>
          </div>
        </div>
      </div>

      {/* Future Features Section */}
      <div className="premium-card p-8">
        <h2 className="text-2xl font-bold text-white mb-6">🚀 Upcoming Features (Stage 2-3)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-900/30 rounded-lg border border-slate-700/50">
            <h3 className="font-semibold text-white mb-2">👤 Face Recognition</h3>
            <p className="text-sm text-slate-400">Deep learning-based facial recognition for missing person identification with 95%+ accuracy</p>
          </div>
          <div className="p-4 bg-slate-900/30 rounded-lg border border-slate-700/50">
            <h3 className="font-semibold text-white mb-2">📱 Mobile App</h3>
            <p className="text-sm text-slate-400">Native iOS/Android app for field operations and real-time notifications</p>
          </div>
          <div className="p-4 bg-slate-900/30 rounded-lg border border-slate-700/50">
            <h3 className="font-semibold text-white mb-2">🔔 Smart Alerts</h3>
            <p className="text-sm text-slate-400">Intelligent alert system with SMS, email, and push notifications for critical events</p>
          </div>
          <div className="p-4 bg-slate-900/30 rounded-lg border border-slate-700/50">
            <h3 className="font-semibold text-white mb-2">📊 Advanced Analytics</h3>
            <p className="text-sm text-slate-400">Predictive analytics and heatmap visualization for crowd flow patterns</p>
          </div>
          <div className="p-4 bg-slate-900/30 rounded-lg border border-slate-700/50">
            <h3 className="font-semibold text-white mb-2">🎥 Multi-Camera Sync</h3>
            <p className="text-sm text-slate-400">Support for 10+ simultaneous camera feeds with centralized monitoring</p>
          </div>
          <div className="p-4 bg-slate-900/30 rounded-lg border border-slate-700/50">
            <h3 className="font-semibold text-white mb-2">🌐 Cloud Integration</h3>
            <p className="text-sm text-slate-400">AWS/Azure cloud deployment with auto-scaling and 99.9% uptime SLA</p>
          </div>
        </div>
      </div>
    </div>
  );
}
