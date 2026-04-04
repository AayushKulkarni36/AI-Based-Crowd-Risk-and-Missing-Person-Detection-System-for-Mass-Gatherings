import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface StatCardProps {
    icon: ReactNode;
    label: string;
    value: string | number;
    trend?: number;
    color?: 'primary' | 'secondary' | 'accent' | 'emerald' | 'red';
}

const colorClasses = {
    primary: 'bg-brand-primary/20 border-brand-primary/40',
    secondary: 'bg-brand-secondary/20 border-brand-secondary/40',
    accent: 'bg-brand-accent/20 border-brand-accent/40',
    emerald: 'bg-emerald-500/20 border-emerald-500/40',
    red: 'bg-red-500/20 border-red-500/40'
};

const iconColorClasses = {
    primary: 'text-brand-primary',
    secondary: 'text-brand-secondary',
    accent: 'text-brand-accent',
    emerald: 'text-emerald-400',
    red: 'text-red-400'
};

export function StatCard({ icon, label, value, trend, color = 'primary' }: StatCardProps) {
    return (
        <motion.div
            whileHover={{ translateY: -4 }}
            className={cn(
                'bg-slate-900/50 border rounded-xl p-6 backdrop-blur-sm transition-all',
                colorClasses[color]
            )}
        >
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-slate-400 text-sm font-medium mb-2">{label}</p>
                    <p className="text-3xl font-bold text-white">{value}</p>
                </div>
                <div className={cn('text-2xl', iconColorClasses[color])}>
                    {icon}
                </div>
            </div>
            {trend !== undefined && (
                <div className="mt-4 flex items-center gap-1">
                    <span className={trend > 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
                    </span>
                    <span className="text-xs text-slate-400">this month</span>
                </div>
            )}
        </motion.div>
    );
}

interface RiskBadgeProps {
    level: 'safe' | 'moderate' | 'risky' | 'critical';
    label?: string;
}

const riskColors = {
    safe: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', text: 'text-emerald-400' },
    moderate: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/40', text: 'text-yellow-400' },
    risky: { bg: 'bg-orange-500/20', border: 'border-orange-500/40', text: 'text-orange-400' },
    critical: { bg: 'bg-red-500/20', border: 'border-red-500/40', text: 'text-red-400' }
};

const riskLabels = {
    safe: 'Safe',
    moderate: 'Moderate Risk',
    risky: 'Risky',
    critical: 'Critical'
};

export function RiskBadge({ level, label }: RiskBadgeProps) {
    const colors = riskColors[level];
    return (
        <span className={cn(
            'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border',
            colors.bg,
            colors.border,
            colors.text
        )}>
            {label || riskLabels[level]}
        </span>
    );
}

interface PersonCardProps {
    id: string;
    name: string;
    age: number;
    status: 'ACTIVE' | 'FOUND';
    photoUrl: string;
    reportedDate: string;
    onSelect?: (id: string) => void;
}

export function PersonCard({ id, name, age, status, photoUrl, reportedDate, onSelect }: PersonCardProps) {
    return (
        <motion.div
            whileHover={{ translateY: -4 }}
            onClick={() => onSelect?.(id)}
            className="bg-slate-900/50 border border-slate-700/50 rounded-xl overflow-hidden hover:border-brand-accent/50 transition-all cursor-pointer group"
        >
            <div className="relative h-48 bg-slate-800 overflow-hidden">
                <img
                    src={photoUrl}
                    alt={name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end">
                    <div className="w-full p-4">
                        <RiskBadge level={status === 'FOUND' ? 'safe' : 'critical'} label={status} />
                    </div>
                </div>
            </div>
            <div className="p-4">
                <h3 className="text-white font-bold text-lg mb-1">{name}</h3>
                <p className="text-slate-400 text-sm mb-3">{age} years old</p>
                <p className="text-xs text-slate-500">Reported: {new Date(reportedDate).toLocaleDateString()}</p>
            </div>
        </motion.div>
    );
}

interface AlertFeedItemProps {
    type: 'crowd' | 'face_match' | 'processing';
    title: string;
    description: string;
    timestamp: Date;
    isRead?: boolean;
}

export function AlertFeedItem({ type, title, description, timestamp, isRead = false }: AlertFeedItemProps) {
    const getIcon = () => {
        switch (type) {
            case 'crowd':
                return '👥';
            case 'face_match':
                return '🔍';
            case 'processing':
                return '⚙️';
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn(
                'p-4 rounded-lg border transition-all',
                isRead
                    ? 'bg-slate-900/20 border-slate-700/30'
                    : 'bg-brand-primary/10 border-brand-primary/40'
            )}
        >
            <div className="flex gap-4">
                <div className="text-2xl flex-shrink-0">{getIcon()}</div>
                <div className="flex-1 min-w-0">
                    <h4 className="text-white font-medium truncate">{title}</h4>
                    <p className="text-slate-400 text-sm mt-1 line-clamp-2">{description}</p>
                    <p className="text-xs text-slate-500 mt-2">{timestamp.toLocaleTimeString()}</p>
                </div>
                {!isRead && <div className="w-2 h-2 bg-brand-accent rounded-full flex-shrink-0 mt-2" />}
            </div>
        </motion.div>
    );
}

interface VideoUploadZoneProps {
    onFilesSelected: (files: File[]) => void;
    isLoading?: boolean;
    accept?: string;
}

export function VideoUploadZone({ onFilesSelected, isLoading = false, accept = 'video/*' }: VideoUploadZoneProps) {
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        onFilesSelected(files);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        onFilesSelected(files);
    };

    return (
        <label className="block">
            <input
                type="file"
                multiple
                accept={accept}
                onChange={handleChange}
                className="hidden"
                disabled={isLoading}
            />
            <motion.div
                whileHover={isLoading ? {} : { borderColor: 'rgba(56, 189, 248, 0.4)' }}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center cursor-pointer hover:border-brand-accent/40 transition-colors bg-slate-900/20"
            >
                <div className="text-4xl mb-3">📹</div>
                <h3 className="text-white font-semibold mb-1">
                    {isLoading ? 'Uploading...' : 'Drop video files here'}
                </h3>
                <p className="text-slate-400 text-sm">or click to select files</p>
                <p className="text-xs text-slate-500 mt-3">Supported formats: MP4, WebM, MOV</p>
            </motion.div>
        </label>
    );
}
