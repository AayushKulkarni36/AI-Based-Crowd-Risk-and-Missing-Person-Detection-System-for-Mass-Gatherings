
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Shield, Eye, Users, Bell, LogOut, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import LanguageSwitcher from './LanguageSwitcher';
import { useTranslation } from '../context/TranslationContext';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

export default function Navbar() {
    const location = useLocation();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { user, logout } = useAuth();
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [unreadAlerts, setUnreadAlerts] = useState(0);
    const userMenuRef = useRef<HTMLDivElement>(null);

    // Fetch unread alert count
    useEffect(() => {
        const fetchAlertCount = async () => {
            try {
                const data = await api.getAlerts();
                // Count alerts from the last 24 hours as "new"
                const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
                const recent = data.alerts.filter(a =>
                    new Date(a.created_at).getTime() > oneDayAgo &&
                    (a.risk_level === 'CRITICAL' || a.risk_level === 'RISKY')
                );
                setUnreadAlerts(recent.length);
            } catch { /* non-blocking */ }
        };
        fetchAlertCount();
        const interval = setInterval(fetchAlertCount, 60000);
        return () => clearInterval(interval);
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
                setIsUserMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const navItems = [
        { name: t('nav.dashboard'), path: '/dashboard', icon: Shield },
        { name: t('nav.crowd'), path: '/crowd', icon: Users },
        { name: t('nav.missing'), path: '/missing-persons', icon: Eye },
        { name: t('nav.alerts'), path: '/alerts', icon: Bell },
    ];

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <nav className="glass-nav sticky top-0 z-50 bg-slate-900/50 border-b border-slate-700/50 backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center">
                        <Link to="/" className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-brand-accent rounded-lg flex items-center justify-center shadow-lg shadow-brand-accent/20">
                                <Shield className="w-5 h-5 text-brand-surface" />
                            </div>
                            <span className="text-xl font-bold text-white tracking-tight">
                                CrowdNexis <span className="text-sky-400">AI</span>
                            </span>
                        </Link>
                    </div>

                    <div className="flex items-center space-x-1">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = location.pathname === item.path;
                            const isAlerts = item.path === '/alerts';
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={clsx(
                                        'relative flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200',
                                        isActive
                                            ? 'text-brand-accent bg-brand-secondary shadow-sm shadow-brand-accent/5'
                                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                                    )}
                                >
                                    <Icon className="w-4 h-4 mr-2" />
                                    {item.name}
                                    {/* Alert badge */}
                                    {isAlerts && unreadAlerts > 0 && (
                                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-pulse">
                                            {unreadAlerts > 9 ? '9+' : unreadAlerts}
                                        </span>
                                    )}
                                </Link>
                            );
                        })}

                        <div className="pl-4 border-l border-white/10 ml-2 flex items-center gap-3">
                            <LanguageSwitcher />

                            {/* User Menu */}
                            <div className="relative" ref={userMenuRef}>
                                <button
                                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                    className="flex items-center gap-2 px-3 py-2 rounded-md text-white hover:bg-white/5 transition-colors"
                                >
                                    <div className="w-7 h-7 bg-brand-accent rounded-full flex items-center justify-center text-xs font-bold text-slate-900">
                                        {(user?.full_name || user?.email)?.[0]?.toUpperCase()}
                                    </div>
                                    <div className="hidden sm:block text-left">
                                        <p className="text-white text-xs font-medium leading-none">{user?.full_name || user?.email?.split('@')[0]}</p>
                                        <p className="text-slate-400 text-[10px] leading-none mt-0.5 capitalize">{user?.role?.toLowerCase()}</p>
                                    </div>
                                    <ChevronDown className={clsx("w-3 h-3 text-slate-400 transition-transform", isUserMenuOpen && "rotate-180")} />
                                </button>

                                {isUserMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-52 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-10 overflow-hidden">
                                        <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/50">
                                            <p className="text-white font-medium text-sm">{user?.full_name || 'User'}</p>
                                            <p className="text-xs text-slate-400 mt-0.5">{user?.email}</p>
                                            <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30 uppercase">
                                                {user?.role}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => {
                                                handleLogout();
                                                setIsUserMenuOpen(false);
                                            }}
                                            className="w-full text-left px-4 py-2.5 text-slate-300 hover:text-white hover:bg-slate-700/50 flex items-center gap-2 transition-colors text-sm"
                                        >
                                            <LogOut className="w-4 h-4" />
                                            Logout
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
}
