import { motion } from 'framer-motion';
import { Users, Video, AlertTriangle, CheckCircle2, TrendingUp, Activity } from 'lucide-react';
import { StatCard, RiskBadge } from '../components/ui/Cards';
import { Card, Button, ProgressBar } from '../components/ui/Common';
import { useSocket } from '../hooks/useSocket';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '../lib/utils';
import { api, StatsOverview, AlertLog, DetectionPoint } from '../services/api';
import { toast } from 'sonner';

interface ChartData { time: string; value: number; }

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const item = { hidden: { y: 20, opacity: 0 }, show: { y: 0, opacity: 1 } };

const CHART_PLACEHOLDER: ChartData[] = [
  { time: '00:00', value: 0 }, { time: '04:00', value: 0 },
  { time: '08:00', value: 0 }, { time: '12:00', value: 0 },
  { time: '16:00', value: 0 }, { time: '20:00', value: 0 },
];

function StatSkeleton() {
  return (
    <div className="bg-slate-900/50 border border-slate-700/40 rounded-xl p-6 animate-pulse">
      <div className="h-4 bg-slate-700 rounded w-3/4 mb-3" />
      <div className="h-8 bg-slate-700 rounded w-1/2" />
    </div>
  );
}

function AlertSkeleton() {
  return (
    <div className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-lg animate-pulse">
      <div className="w-2 h-2 rounded-full bg-slate-700 flex-shrink-0 mt-2" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-slate-700 rounded w-3/4" />
        <div className="h-3 bg-slate-700 rounded w-1/2" />
      </div>
    </div>
  );
}

function riskLevelToSeverity(level: string): 'safe' | 'moderate' | 'risky' | 'critical' {
  switch (level?.toUpperCase()) {
    case 'CRITICAL': return 'critical';
    case 'RISKY': return 'risky';
    case 'MODERATE': return 'moderate';
    default: return 'safe';
  }
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { isConnected, queueStats } = useSocket();
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [alerts, setAlerts] = useState<AlertLog[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [chartData, setChartData] = useState<ChartData[]>(CHART_PLACEHOLDER);

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.getStatsOverview();
      setStats(data);
    } catch (err: any) {
      toast.error('Could not load dashboard stats');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await api.getAlerts();
      setAlerts(data.alerts.slice(0, 5)); // show last 5
    } catch (err: any) {
      // non-blocking
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  const fetchDetectionsChart = useCallback(async () => {
    try {
      const data = await api.getDetectionsToday();
      const points = data.points || [];
      if (points.length === 0) {
        setChartData(CHART_PLACEHOLDER);
        return;
      }
      setChartData(
        points.map((p: DetectionPoint) => ({
          time: p.time,
          value: Number(p.value || 0)
        }))
      );
    } catch (_) {
      // non-blocking
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchAlerts();
    fetchDetectionsChart();
  }, [fetchStats, fetchAlerts, fetchDetectionsChart]);

  useEffect(() => {
    // Keep dashboard counters fresh after background face-match updates.
    const interval = setInterval(() => {
      fetchStats();
      fetchAlerts();
      fetchDetectionsChart();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchStats, fetchAlerts, fetchDetectionsChart]);

  return (
    <motion.div className="space-y-8" variants={container} initial="hidden" animate="show">
      {/* Hero */}
      <motion.div variants={item} className="text-center space-y-4 mb-8">
        <h1 className="text-4xl font-bold text-white">Welcome back! 👋</h1>
        <p className="text-slate-400 text-lg">
          Real-time crowd risk detection &amp; missing person identification
        </p>
        <div className="flex items-center justify-center gap-2 mt-4">
          <div className={cn('w-2 h-2 rounded-full animate-pulse', isConnected ? 'bg-emerald-500' : 'bg-red-500')} />
          <span className="text-sm text-slate-400">
            {isConnected ? 'System Online' : 'Connecting...'}
          </span>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statsLoading ? (
          Array.from({ length: 6 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          <>
            <StatCard icon={<Video />} label="Videos Processed" value={stats?.completedVideos ?? 0} color="primary" />
            <StatCard icon={<Users />} label="Active Missing Persons" value={stats?.activePersons ?? 0} color="accent" />
            <StatCard icon={<AlertTriangle />} label="Critical Alerts Today" value={stats?.criticalAlertsToday ?? 0} color="red" />
            <StatCard icon={<CheckCircle2 />} label="Found Persons" value={stats?.foundPersons ?? 0} color="emerald" />
            <StatCard icon={<TrendingUp />} label="Total Face Matches" value={stats?.totalFaceMatches ?? 0} color="secondary" />
            <StatCard icon={<Activity />} label="Queue Status" value={isNaN(queueStats.waiting + queueStats.active) ? 0 : queueStats.waiting + queueStats.active} color="primary" />
          </>
        )}
      </motion.div>

      {/* Queue & Chart */}
      <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-xl font-bold text-white mb-6">Processing Queue</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-slate-400 text-sm">Active Jobs</span>
                <span className="text-white font-semibold">{queueStats.active}</span>
              </div>
              <ProgressBar value={queueStats.active} max={5} color="primary" />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-slate-400 text-sm">Waiting Jobs</span>
                <span className="text-white font-semibold">{queueStats.waiting}</span>
              </div>
              <ProgressBar value={queueStats.waiting} max={20} color="warning" />
            </div>
            <div className="pt-4 border-t border-slate-700">
              <p className="text-slate-400 text-sm">Completed: <span className="text-white font-semibold">{queueStats.completed}</span></p>
              <p className="text-slate-400 text-sm">Failed: <span className="text-white font-semibold">{queueStats.failed}</span></p>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-xl font-bold text-white mb-6">Detections Today</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" stroke="#cbd5e1" />
              <YAxis stroke="#cbd5e1" />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#fff' }} />
              <Line type="monotone" dataKey="value" stroke="#38bdf8" strokeWidth={2} dot={{ fill: '#38bdf8', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </motion.div>

      {/* Action Cards */}
      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="hover:border-brand-accent/50 cursor-pointer" onClick={() => navigate('/crowd')}>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold text-white mb-2">Upload Video</h3>
              <p className="text-slate-400 text-sm mb-4">Upload footage for crowd risk analysis and missing person detection.</p>
              <Button variant="primary" size="sm" type="button">Start Analysis</Button>
            </div>
            <Video className="w-8 h-8 text-brand-accent opacity-20" />
          </div>
        </Card>
        <Card className="hover:border-brand-accent/50 cursor-pointer" onClick={() => navigate('/missing-persons')}>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold text-white mb-2">Missing Persons</h3>
              <p className="text-slate-400 text-sm mb-4">Manage missing person database and face enrollment for matching.</p>
              <Button variant="primary" size="sm" type="button">View Database</Button>
            </div>
            <Users className="w-8 h-8 text-brand-accent opacity-20" />
          </div>
        </Card>
      </motion.div>

      {/* Recent Alerts */}
      <motion.div variants={item}>
        <Card>
          <h3 className="text-xl font-bold text-white mb-6">Recent Alerts</h3>
          <div className="space-y-3">
            {alertsLoading ? (
              Array.from({ length: 3 }).map((_, i) => <AlertSkeleton key={i} />)
            ) : alerts.length === 0 ? (
              <div className="text-center py-8">
                <AlertTriangle className="w-10 h-10 text-slate-600 mx-auto mb-3 opacity-50" />
                <p className="text-slate-500 text-sm">No alerts yet. Process a video to generate alerts.</p>
              </div>
            ) : (
              alerts.map((alert) => (
                <div key={alert.id} className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-lg">
                  <div className={cn('w-2 h-2 rounded-full flex-shrink-0 mt-2', {
                    'bg-red-500': alert.risk_level === 'CRITICAL',
                    'bg-orange-500': alert.risk_level === 'RISKY',
                    'bg-yellow-500': alert.risk_level === 'MODERATE',
                    'bg-emerald-500': alert.risk_level === 'SAFE',
                  })} />
                  <div className="flex-1">
                    <p className="text-white font-medium text-sm">{alert.message || alert.alert_type}</p>
                    <p className="text-slate-500 text-xs mt-1">{formatRelativeTime(alert.created_at)}</p>
                  </div>
                  <RiskBadge level={riskLevelToSeverity(alert.risk_level)} />
                </div>
              ))
            )}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
