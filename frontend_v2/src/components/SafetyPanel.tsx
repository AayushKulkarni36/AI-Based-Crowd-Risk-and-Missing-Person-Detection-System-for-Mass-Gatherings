import { AlertTriangle, Info, CheckCircle, ShieldAlert } from 'lucide-react';
import { useTranslation } from '../context/TranslationContext';
import clsx from 'clsx';
import { motion } from 'framer-motion';

interface SafetyPanelProps {
    riskLevel?: string; // "Low" | "Medium" | "High" (from backend logic or inferred)
}

export default function SafetyPanel({ riskLevel = "Low" }: SafetyPanelProps) {
    const { t } = useTranslation();

    const getRiskInfo = (risk: string) => {
        switch (risk.toLowerCase()) {
            case 'high':
                return { color: 'bg-red-500', border: 'border-red-500', text: 'text-red-400', message: t('safety.high'), icon: ShieldAlert };
            case 'medium':
                return { color: 'bg-amber-500', border: 'border-amber-500', text: 'text-amber-400', message: t('safety.medium'), icon: AlertTriangle };
            default:
                return { color: 'bg-emerald-500', border: 'border-emerald-500', text: 'text-emerald-400', message: t('safety.normal'), icon: CheckCircle };
        }
    };

    const info = getRiskInfo(riskLevel);
    const Icon = info.icon;

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className={clsx("card border-l-4", info.border)}
        >
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <Icon className={clsx("w-5 h-5", info.text)} />
                Safety Protocol: {riskLevel} Risk
            </h3>
            <p className="text-slate-300">
                {info.message}
            </p>

            <div className="mt-4 pt-4 border-t border-white/10 text-sm text-slate-500">
                <div className="flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    <span>AI Recommendation based on live crowd density.</span>
                </div>
            </div>
        </motion.div>
    );
}
