import { motion } from 'framer-motion';
import { Users, Video, AlertTriangle, CheckCircle2, TrendingUp, Activity, Clock, Zap, MapPin, ShieldAlert, BarChart3 } from 'lucide-react';
import { StatCard, RiskBadge } from '../components/ui/Cards';
import { Card, Button } from '../components/ui/Common';
import { useSocket } from '../hooks/useSocket';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { cn } from '../lib/utils';
import { api, StatsOverview, AlertLog, MissingPerson } from '../services/api';
import { toast } from 'sonner';

interface RiskChartData { level: string; count: number; color: string; }

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const item = { hidden: { y: 20, opacity: 0 }, show: { y: 0, opacity: 1 } };

const RISK_COLORS: Record<string, string> = {
  CRITICAL: '#ef4444',
  RISKY:    '#f97316',
  MODERATE: '#eab308',
  SAFE:     '#22c55e',
};

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
  const { isConnected } = useSocket();
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [alerts, setAlerts] = useState<AlertLog[]>([]);
  const [activePersons, setActivePersons] = useState<MissingPerson[]>([]);
  const [riskChart, setRiskChart] = useState<RiskChartData[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [personsLoading, setPersonsLoading] = useState(true);

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

  const fetchPersonsAndRisk = useCallback(async () => {
    try {
      const [personsData, alertsData] = await Promise.all([
        api.getMissingPersons(),
        api.getAlerts(),
      ]);
      // Active persons panel
      const active = (personsData.persons || []).filter(p => p.status === 'ACTIVE');
      setActivePersons(active);

      // Build risk distribution from all alerts
      const counts: Record<string, number> = { CRITICAL: 0, RISKY: 0, MODERATE: 0, SAFE: 0 };
      (alertsData.alerts || []).forEach(a => {
        const lvl = a.risk_level?.toUpperCase();
        if (lvl in counts) counts[lvl]++;
      });
      setRiskChart(
        Object.entries(counts)
          .filter(([, v]) => v > 0)
          .map(([level, count]) => ({ level, count, color: RISK_COLORS[level] }))
          .sort((a, b) => {
            const order = ['CRITICAL','RISKY','MODERATE','SAFE'];
            return order.indexOf(a.level) - order.indexOf(b.level);
          })
      );
    } catch {
      // non-blocking
    } finally {
      setPersonsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchAlerts();
    fetchPersonsAndRisk();
  }, [fetchStats, fetchAlerts, fetchPersonsAndRisk]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats();
      fetchAlerts();
      fetchPersonsAndRisk();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchStats, fetchAlerts, fetchPersonsAndRisk]);

  return (
    <motion.div className="space-y-8" variants={container} initial="hidden" animate="show">
      {/* Hero */}
      <motion.div variants={item} className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 p-8 mb-2">
        {/* Animated background glow */}
        <div className="absolute top-0 left-1/4 w-64 h-32 bg-sky-500/10 blur-3xl rounded-full" />
        <div className="absolute bottom-0 right-1/4 w-48 h-24 bg-indigo-500/8 blur-3xl rounded-full" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-sky-500/20 border border-sky-500/30 rounded-xl flex items-center justify-center">
                <Zap className="w-5 h-5 text-sky-400" />
              </div>
              <span className="text-sky-400 text-sm font-semibold tracking-widest uppercase">AI-Powered Surveillance</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              CrowdNexis <span className="text-sky-400">AI</span>
            </h1>
            <p className="text-slate-400 text-base max-w-xl">
              Real-time crowd risk detection &amp; missing person identification using YOLOv8 + FaceNet
            </p>
          </div>
          <div className="flex flex-col gap-2 text-sm shrink-0">
            <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-full border', isConnected ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400')}>
              <div className={cn('w-2 h-2 rounded-full', isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400')} />
              {isConnected ? 'System Online' : 'Connecting...'}
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-slate-800/50 border-slate-700 text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              Live Monitoring Active
            </div>
          </div>
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
            <StatCard icon={<Activity />} label="Total People Detected" value={stats?.totalPeopleDetected ?? 0} color="primary" />
          </>
        )}
      </motion.div>

      {/* Active Cases + Risk Distribution */}
      <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Active Missing Persons Panel */}
        <Card>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-amber-500/15 border border-amber-500/30 rounded-lg flex items-center justify-center">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
              </div>
              <h3 className="text-lg font-bold text-white">Active Missing Cases</h3>
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400">
              {activePersons.length} ACTIVE
            </span>
          </div>

          {personsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-slate-800/40 rounded-lg animate-pulse">
                  <div className="w-9 h-9 rounded-full bg-slate-700 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-slate-700 rounded w-1/2" />
                    <div className="h-2 bg-slate-700 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : activePersons.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500/40 mb-3" />
              <p className="text-slate-400 text-sm">No active missing person cases</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {activePersons.map((person, idx) => (
                <motion.div
                  key={person.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center gap-3 p-3 bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/40 hover:border-amber-500/30 rounded-lg cursor-pointer transition-all"
                  onClick={() => navigate('/missing-persons')}
                >
                  {/* Avatar */}
                  <div className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold',
                    person.gender?.toLowerCase() === 'female'
                      ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                      : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                  )}>
                    {person.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{person.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-slate-400 text-xs">{person.age}y • {person.gender}</span>
                      {person.last_seen_location && (
                        <span className="flex items-center gap-0.5 text-slate-500 text-xs">
                          <MapPin className="w-2.5 h-2.5" />
                          {person.last_seen_location}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 font-medium">ACTIVE</span>
                    <p className="text-slate-500 text-xs mt-1">{formatRelativeTime(person.reported_date)}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-slate-700/50">
            <Button variant="ghost" size="sm" type="button" className="w-full" onClick={() => navigate('/missing-persons')}>
              <Users className="w-4 h-4 mr-2" /> View All Missing Persons
            </Button>
          </div>
        </Card>

        {/* Alert Risk Distribution */}
        <Card>
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 bg-sky-500/15 border border-sky-500/30 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-sky-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Alert Risk Distribution</h3>
          </div>

          {riskChart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[220px] text-center">
              <Activity className="w-10 h-10 text-slate-600 mx-auto mb-3 opacity-40" />
              <p className="text-slate-500 text-sm">No alert data yet. Process a video to see distribution.</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={riskChart} margin={{ top: 5, right: 10, left: -20, bottom: 5 }} barSize={36}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="level" stroke="#64748b" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#64748b" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px' }}
                    formatter={(v: any) => [`${v} alerts`, 'Count']}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {riskChart.map((entry) => (
                      <Cell key={entry.level} fill={entry.color} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {/* Legend chips */}
              <div className="flex flex-wrap gap-2 mt-3">
                {riskChart.map(({ level, count, color }) => (
                  <div key={level} className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
                    {level}: <span className="text-white font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
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
