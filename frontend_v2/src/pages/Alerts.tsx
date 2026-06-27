import { motion } from 'framer-motion';
import { Bell, Search, X } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { RiskBadge } from '../components/ui/Cards';
import { Card, Button } from '../components/ui/Common';
import { cn } from '../lib/utils';
import { useSocket } from '../hooks/useSocket';
import { api, AlertLog } from '../services/api';
import { toast } from 'sonner';

// Map DB risk_level to RiskBadge severity
type Severity = 'safe' | 'moderate' | 'risky' | 'critical';

interface UIAlert {
  id: string;
  type: 'crowd' | 'face_match' | 'processing';
  title: string;
  description: string;
  timestamp: Date;
  isRead: boolean;
  severity: Severity;
  imagePath?: string;
}

function toSeverity(risk: string): Severity {
  switch (risk?.toUpperCase()) {
    case 'CRITICAL': return 'critical';
    case 'RISKY': return 'risky';
    case 'MODERATE': return 'moderate';
    default: return 'safe';
  }
}

function alertTypeToUI(type: string): UIAlert['type'] {
  if (type === 'FACE_MATCH') return 'face_match';
  if (type === 'CROWD_DETECTION' || type === 'CROWD') return 'crowd';
  return 'processing';
}

function dbAlertToUI(a: AlertLog): UIAlert {
  return {
    id: String(a.id),
    type: alertTypeToUI(a.alert_type),
    title: a.message?.split(':')[0] || a.alert_type.replace(/_/g, ' '),
    description: a.message || `Risk level: ${a.risk_level}`,
    timestamp: new Date(a.created_at),
    isRead: false,
    severity: toSeverity(a.risk_level),
    imagePath: a.image_path || undefined,
  };
}

function formatTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMs / 3600000);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function AlertSkeleton() {
  return (
    <div className="p-4 rounded-lg border border-slate-700/30 animate-pulse space-y-2">
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 bg-slate-700 rounded" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-700 rounded w-2/3" />
          <div className="h-3 bg-slate-700 rounded w-1/2" />
        </div>
      </div>
    </div>
  );
}

function AlertImage({ src, alt }: { src: string; alt: string }) {
  const [errored, setErrored] = useState(false);
  if (errored) {
    return (
      <div className="w-16 h-16 rounded-md border border-amber-500/30 bg-amber-500/10 flex-shrink-0 flex flex-col items-center justify-center gap-1">
        <span className="text-2xl">🔍</span>
        <span className="text-[9px] text-amber-400 font-medium text-center leading-tight">detection<br/>snapshot</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      crossOrigin="anonymous"
      className="w-16 h-16 rounded-md object-cover border border-amber-500/30 flex-shrink-0 bg-slate-800"
      onError={() => setErrored(true)}
    />
  );
}

export default function Alerts() {
  const { on, off } = useSocket();
  const [alerts, setAlerts] = useState<UIAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'crowd' | 'face_match' | 'processing'>('all');
  const [filterSeverity, setFilterSeverity] = useState<'all' | Severity>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await api.getAlerts();
      setAlerts(data.alerts.map(dbAlertToUI));
    } catch (err: any) {
      toast.error('Could not load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Real-time socket alerts
  useEffect(() => {
    const handleCrowdAlert = (data: any) => {
      const newAlert: UIAlert = {
        id: `rt-${Date.now()}`,
        type: 'crowd',
        title: 'Crowd Density Alert',
        description: data.message || `${data.personCount ?? 0} people detected — ${data.riskLevel ?? 'UNKNOWN'}`,
        timestamp: new Date(),
        isRead: false,
        severity: toSeverity(data.riskLevel),
      };
      setAlerts(prev => {
        // Deduplicate by checking last 5 alerts for same type+severity within 10 seconds
        if (prev.some(a => a.type === 'crowd' && a.severity === newAlert.severity &&
            Date.now() - a.timestamp.getTime() < 10000)) return prev;
        return [newAlert, ...prev];
      });
      toast.warning(`Crowd alert: ${data.riskLevel}`, { description: newAlert.description });
    };

    const handleFaceMatch = (data: any) => {
      const newAlert: UIAlert = {
        id: `rt-face-${Date.now()}`,
        type: 'face_match',
        title: 'Face Match Found',
        description: `${data.name ?? 'Person'} matched with ${((data.confidence ?? 0) * 100).toFixed(1)}% confidence`,
        timestamp: new Date(),
        isRead: false,
        severity: 'moderate',
      };
      setAlerts(prev => [newAlert, ...prev]);
      toast.info(`Face match: ${data.name}`, { description: newAlert.description });
    };

    on('crowd:alert', handleCrowdAlert);
    on('face:match', handleFaceMatch);

    return () => {
      off('crowd:alert');
      off('face:match');
    };
  }, [on, off]);

  const unreadCount = alerts.filter(a => !a.isRead).length;

  const filteredAlerts = alerts.filter(alert => {
    const typeMatch = filterType === 'all' || alert.type === filterType;
    const severityMatch = filterSeverity === 'all' || alert.severity === filterSeverity;
    const searchMatch = !searchQuery || alert.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.description.toLowerCase().includes(searchQuery.toLowerCase());
    return typeMatch && severityMatch && searchMatch;
  });

  const markAsRead = (id: string) =>
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, isRead: true } : a));

  const markAllAsRead = () =>
    setAlerts(prev => prev.map(a => ({ ...a, isRead: true })));

  const deleteAlert = (id: string) =>
    setAlerts(prev => prev.filter(a => a.id !== id));

  const deleteAllRead = () =>
    setAlerts(prev => prev.filter(a => !a.isRead));

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-4xl font-bold text-white flex items-center gap-3">
            <Bell className="w-8 h-8" />
            Alerts &amp; Notifications
          </h1>
          {unreadCount > 0 && (
            <div className="bg-red-500 text-white px-4 py-2 rounded-full font-semibold">
              {unreadCount} New
            </div>
          )}
        </div>
        <p className="text-slate-400">Real-time alerts for crowd density, face matches, and processing events</p>
      </div>

      {/* Filter Bar */}
      <Card className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search alerts..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-brand-accent"
            />
          </div>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value as any)}
            className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-brand-accent"
          >
            <option value="all">All Types</option>
            <option value="crowd">Crowd Alerts</option>
            <option value="face_match">Face Matches</option>
            <option value="processing">Processing</option>
          </select>
          <select
            value={filterSeverity}
            onChange={e => setFilterSeverity(e.target.value as any)}
            className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-brand-accent"
          >
            <option value="all">All Severity</option>
            <option value="safe">Safe</option>
            <option value="moderate">Moderate</option>
            <option value="risky">Risky</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={markAllAsRead} disabled={unreadCount === 0}>
            Mark All Read
          </Button>
          <Button variant="danger" size="sm" onClick={deleteAllRead}>Clear Read</Button>
        </div>
      </Card>

      {/* Alerts List */}
      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <AlertSkeleton key={i} />)
        ) : filteredAlerts.length > 0 ? (
          filteredAlerts.map((alert, idx) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.04 }}
              className="group"
            >
              <div
                className={cn(
                  'p-4 rounded-lg border transition-all cursor-pointer',
                  alert.isRead
                    ? 'bg-slate-900/20 border-slate-700/30 hover:border-slate-700/50'
                    : 'bg-brand-primary/10 border-brand-primary/40 hover:border-brand-primary/60'
                )}
                onClick={() => !alert.isRead && markAsRead(alert.id)}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 text-2xl">
                    {alert.type === 'crowd' && '👥'}
                    {alert.type === 'face_match' && '🔍'}
                    {alert.type === 'processing' && '⚙️'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-semibold">{alert.title}</h4>
                    <p className="text-slate-400 text-sm mt-1 line-clamp-2">{alert.description}</p>
                    <div className="flex items-center gap-3 mt-3">
                      <p className="text-xs text-slate-500">{formatTime(alert.timestamp)}</p>
                      <RiskBadge level={alert.severity} />
                    </div>
                  </div>
                  {alert.imagePath ? (
                    <AlertImage src={`http://localhost:5000/${alert.imagePath}`} alt={alert.title} />
                  ) : null}

                  <div className="flex-shrink-0 flex items-center gap-2">
                    {!alert.isRead && <div className="w-2 h-2 bg-brand-accent rounded-full" />}
                    <button
                      onClick={e => { e.stopPropagation(); deleteAlert(alert.id); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-slate-700/50 rounded"
                    >
                      <X className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <Card className="text-center py-12">
            <Bell className="w-12 h-12 text-slate-600 mx-auto mb-4 opacity-50" />
            <p className="text-slate-400">
              {alerts.length === 0 ? 'No alerts yet. Process a video to generate alerts.' : 'No alerts match your filters.'}
            </p>
          </Card>
        )}
      </div>

      {/* Stats Footer */}
      <Card className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div><p className="text-slate-400 text-sm mb-1">Total Alerts</p><p className="text-white text-2xl font-bold">{alerts.length}</p></div>
        <div><p className="text-slate-400 text-sm mb-1">Unread</p><p className="text-brand-accent text-2xl font-bold">{unreadCount}</p></div>
        <div><p className="text-slate-400 text-sm mb-1">Critical</p><p className="text-red-400 text-2xl font-bold">{alerts.filter(a => a.severity === 'critical').length}</p></div>
        <div>
          <p className="text-slate-400 text-sm mb-1">This Hour</p>
          <p className="text-emerald-400 text-2xl font-bold">
            {alerts.filter(a => Date.now() - a.timestamp.getTime() < 3600000).length}
          </p>
        </div>
      </Card>
    </motion.div>
  );
}
