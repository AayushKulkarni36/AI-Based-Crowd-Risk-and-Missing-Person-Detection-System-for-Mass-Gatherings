import { AlertTriangle, CheckCircle, AlertOctagon } from 'lucide-react';

const RISK_CONFIG = {
  SAFE: {
    icon: CheckCircle,
    color: 'emerald',
    text: 'Safe',
    description: 'Occupancy within normal limits'
  },
  MODERATE: {
    icon: AlertTriangle,
    color: 'amber',
    text: 'Moderate',
    description: 'Approaching maximum capacity'
  },
  RISKY: {
    icon: AlertTriangle,
    color: 'orange',
    text: 'Risky',
    description: 'Near capacity limit'
  },
  CRITICAL: {
    icon: AlertOctagon,
    color: 'red',
    text: 'Critical',
    description: 'CRITICAL OVERCROWDING',
    animate: 'animate-pulse'
  }
};

export default function RiskBadge({ level = 'SAFE' }) {
  const config = RISK_CONFIG[level] || RISK_CONFIG.SAFE;
  const Icon = config.icon;
  const colorMap = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20'
  };

  return (
    <div
      className={`inline-flex items-center space-x-3 px-6 py-3 rounded-xl border ${colorMap[config.color]} ${config.animate || ''}`}
    >
      <Icon className="w-5 h-5" />
      <div>
        <span className="text-lg font-bold">{config.text}</span>
        <p className="text-xs text-slate-400 mt-0.5">{config.description}</p>
      </div>
    </div>
  );
}
