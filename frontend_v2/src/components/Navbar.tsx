
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Shield, Eye, Users, Bell, LogOut, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import LanguageSwitcher from './LanguageSwitcher';
import { useTranslation } from '../context/TranslationContext';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

export default function Navbar() {
    const location = useLocation();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { user, logout } = useAuth();
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

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
                                CrowdNexis AI
                            </span>
                        </Link>
                    </div>

                    <div className="flex items-center space-x-4">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = location.pathname === item.path;
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={clsx(
                                        'flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200',
                                        isActive
                                            ? 'text-brand-accent bg-brand-secondary shadow-sm shadow-brand-accent/5'
                                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                                    )}
                                >
                                    <Icon className="w-4 h-4 mr-2" />
                                    {item.name}
                                </Link>
                            );
                        })}

                        <div className="pl-4 border-l border-white/10 ml-4 flex items-center gap-4">
                            <LanguageSwitcher />

                            {/* User Menu */}
                            <div className="relative">
                                <button
                                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                    className="flex items-center gap-2 px-3 py-2 rounded-md text-white hover:bg-white/5 transition-colors"
                                >
                                    <div className="w-6 h-6 bg-brand-accent rounded-full flex items-center justify-center text-xs font-bold text-slate-900">
                                        {user?.email?.[0]?.toUpperCase()}
                                    </div>
                                    <ChevronDown className="w-4 h-4" />
                                </button>

                                {isUserMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-10">
                                        <div className="px-4 py-3 border-b border-slate-700">
                                            <p className="text-white font-medium">{user?.email}</p>
                                            <p className="text-xs text-slate-400 mt-1 capitalize">{user?.role?.toLowerCase()}</p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                handleLogout();
                                                setIsUserMenuOpen(false);
                                            }}
                                            className="w-full text-left px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700/50 flex items-center gap-2 transition-colors"
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
