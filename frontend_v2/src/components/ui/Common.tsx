import { ReactNode, useState } from 'react';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    children: ReactNode;
}

const variantClasses = {
    primary: 'bg-gradient-to-r from-brand-primary to-brand-accent text-white hover:opacity-90',
    secondary: 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700',
    outline: 'border border-brand-accent text-brand-accent hover:bg-brand-accent/10',
    ghost: 'text-white hover:bg-slate-800/50',
    danger: 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/40',
};

const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
};

export function Button({
    variant = 'primary',
    size = 'md',
    className,
    children,
    disabled,
    ...props
}: ButtonProps) {
    return (
        <button
            disabled={disabled}
            className={cn(
                'rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-102 active:scale-98',
                variantClasses[variant],
                sizeClasses[size],
                className
            )}
            {...props}
        >
            {children}
        </button>
    );
}

interface CardProps {
    children: ReactNode;
    className?: string;
    onClick?: () => void;
}

export function Card({ children, className, onClick }: CardProps) {
    return (
        <div
            onClick={onClick}
            className={cn(
                'bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 backdrop-blur-sm hover:border-brand-accent/50 transition-all',
                onClick && 'cursor-pointer',
                className
            )}
        >
            {children}
        </div>
    );
}

interface TabsProps {
    tabs: Array<{ id: string; label: string; content: ReactNode }>;
    defaultTab?: string;
}

export function Tabs({ tabs, defaultTab }: TabsProps) {
    const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

    return (
        <div>
            <div className="flex gap-2 border-b border-slate-700/50 mb-6">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            'pb-3 px-4 border-b-2 font-medium text-sm transition-colors',
                            activeTab === tab.id
                                ? 'border-brand-accent text-white'
                                : 'border-transparent text-slate-400 hover:text-white'
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            <div>
                {tabs.find((t) => t.id === activeTab)?.content}
            </div>
        </div>
    );
}

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    footer?: ReactNode;
}

export function Modal({ isOpen, onClose, title, children, footer }: ModalProps) {
    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-slate-900/95 border border-slate-700/50 rounded-2xl w-full max-w-md flex flex-col"
                style={{ maxHeight: '90vh' }}
            >
                {/* Fixed header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-800 shrink-0">
                    <h2 className="text-xl font-bold text-white">{title}</h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800"
                    >
                        ✕
                    </button>
                </div>
                {/* Scrollable body */}
                <div className="overflow-y-auto px-6 py-4 flex-1">
                    {children}
                </div>
                {/* Sticky footer — always visible */}
                {footer && (
                    <div className="px-6 py-4 border-t border-slate-800 shrink-0 bg-slate-900/95 rounded-b-2xl">
                        {footer}
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}

interface ProgressBarProps {
    value: number;
    max?: number;
    color?: 'primary' | 'success' | 'warning' | 'danger';
}

export function ProgressBar({ value, max = 100, color = 'primary' }: ProgressBarProps) {
    const colors = {
        primary: 'bg-brand-accent',
        success: 'bg-emerald-500',
        warning: 'bg-yellow-500',
        danger: 'bg-red-500',
    };

    const percentage = (value / max) * 100;

    return (
        <div className="w-full bg-slate-800/50 rounded-full h-2 overflow-hidden">
            <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 0.3 }}
                className={cn('h-full transition-all', colors[color])}
            />
        </div>
    );
}
