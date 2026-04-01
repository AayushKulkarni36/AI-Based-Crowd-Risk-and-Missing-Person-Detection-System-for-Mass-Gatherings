
import { Link, useLocation } from 'react-router-dom';
import { Shield, Eye, Users } from 'lucide-react';
import clsx from 'clsx';
import LanguageSwitcher from './LanguageSwitcher';
import { useTranslation } from '../context/TranslationContext';

export default function Navbar() {
    const location = useLocation();
    const { t } = useTranslation();

    const navItems = [
        { name: t('nav.dashboard'), path: '/', icon: Shield },
        { name: t('nav.crowd'), path: '/crowd', icon: Users },
        { name: t('nav.missing'), path: '/missing-person', icon: Eye },
    ];

    return (
        <nav className="glass-nav sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center">
                        <Link to="/" className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-brand-accent rounded-lg flex items-center justify-center shadow-lg shadow-brand-accent/20">
                                <Shield className="w-5 h-5 text-brand-surface" />
                            </div>
                            <span className="text-xl font-bold text-white tracking-tight">
                                CivicVision
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
                        <div className="pl-4 border-l border-white/10 ml-4">
                            <LanguageSwitcher />
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
}
