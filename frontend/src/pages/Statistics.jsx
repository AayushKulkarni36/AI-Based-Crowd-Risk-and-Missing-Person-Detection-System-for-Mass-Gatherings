import { useEffect, useState } from 'react';
import { ShieldAlert, BarChart3 } from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { api } from '../services/api.js';

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

export default function Statistics() {
  const [overview, setOverview] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        const [overviewRes, alertsRes] = await Promise.all([api.getOverview(), api.getAlerts()]);
        setOverview(overviewRes.data);
        setAlerts(alertsRes.data);
      } catch (err) {
        console.error('Failed to load statistics', err);
        setError('Unable to load statistics data.');
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  const alertPieData = alerts.map((alert) => ({ name: alert.risk_level, value: alert.count }));

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Operational Intelligence</h1>
        <p className="text-slate-400 text-lg">Monitor crowd anomalies and alert trends in real time.</p>
      </div>

      {error && (
        <div className="premium-card p-4 bg-red-500/10 border-red-500/50 text-red-400">
          <p>{error}</p>
        </div>
      )}

      {loading || !overview ? (
        <div className="premium-card p-12">
          <LoadingSpinner message="Crunching the latest stats..." />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="premium-card p-8 space-y-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Crowd Overview</h2>
                <p className="text-slate-400">Key metrics from the monitoring system</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="premium-card p-4 bg-slate-900/30">
                <p className="text-slate-400 text-sm mb-2">Active Missing Persons</p>
                <p className="text-3xl font-bold text-white">{overview.activePersons}</p>
              </div>
              <div className="premium-card p-4 bg-slate-900/30">
                <p className="text-slate-400 text-sm mb-2">Total Detections</p>
                <p className="text-3xl font-bold text-white">{overview.totalDetections}</p>
              </div>
              <div className="premium-card p-4 bg-slate-900/30">
                <p className="text-slate-400 text-sm mb-2">Total Alerts</p>
                <p className="text-3xl font-bold text-white">{overview.totalAlerts}</p>
              </div>
            </div>
          </div>

          <div className="premium-card p-8">
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                <ShieldAlert className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Alerts by Risk Level</h2>
                <p className="text-slate-400">Distribution of incidents across severity bands</p>
              </div>
            </div>
            {alertPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={alertPieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {alertPieData.map((entry, index) => (
                      <Cell key={`cell-${entry.name}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '12px',
                      border: '1px solid #334155',
                      color: '#f8fafc'
                    }}
                  />
                  <Legend wrapperStyle={{ color: '#f8fafc' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-400">No alerts recorded yet.</p>
            )}
          </div>

          <div className="premium-card p-8 xl:col-span-2">
            <h2 className="text-2xl font-bold text-white mb-4">Alert Volume Trend</h2>
            {alertPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={alertPieData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '12px',
                      border: '1px solid #334155',
                      color: '#f8fafc'
                    }}
                  />
                  <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                    {alertPieData.map((entry, index) => (
                      <Cell key={`bar-${entry.name}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-400">No alert trend data available.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
