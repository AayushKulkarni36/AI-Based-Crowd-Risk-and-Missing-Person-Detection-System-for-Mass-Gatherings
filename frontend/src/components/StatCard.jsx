import { TrendingUp, TrendingDown } from 'lucide-react';

export default function StatCard({ title, value, icon: Icon, iconBg, trend, trendUp }) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${iconBg} flex items-center justify-center shadow-lg`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      <p className="text-slate-400 text-sm font-medium mb-2">{title}</p>
      <p className="text-4xl font-bold text-white mb-2">{value}</p>
      {trend && (
        <div className="flex items-center space-x-2">
          {trendUp ? (
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          ) : (
            <TrendingDown className="w-4 h-4 text-emerald-500" />
          )}
          <span className="text-sm text-emerald-500 font-medium">{trend}</span>
        </div>
      )}
    </div>
  );
}
