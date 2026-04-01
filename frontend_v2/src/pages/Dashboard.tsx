import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Eye, ArrowRight, Activity, ShieldCheck } from 'lucide-react';
import { useTranslation } from '../context/TranslationContext';

export default function Dashboard() {
    const { t } = useTranslation();

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const item = {
        hidden: { y: 20, opacity: 0 },
        show: { y: 0, opacity: 1 }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="space-y-12"
            >
                {/* Hero Section */}
                <motion.div variants={item} className="text-center space-y-4">
                    <h1 className="text-5xl font-bold tracking-tight text-white mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-brand-accent to-brand-primary">
                        {t('dashboard.hero.title')}
                    </h1>
                    <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                        {t('dashboard.hero.subtitle')}
                    </p>
                </motion.div>

                {/* Action Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
                    {/* Crowd Card */}
                    <motion.div
                        variants={item}
                        whileHover={{ scale: 1.02 }}
                        className="group relative overflow-hidden rounded-2xl bg-slate-900/50 border border-slate-700/50 p-8 hover:border-brand-primary/50 transition-colors backdrop-blur-md"
                    >
                        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-brand-primary/10 rounded-full blur-2xl group-hover:bg-brand-primary/20 transition-all"></div>

                        <div className="relative z-10">
                            <div className="w-12 h-12 bg-default/20 rounded-xl flex items-center justify-center mb-6 text-brand-accent">
                                <Users className="w-6 h-6" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">{t('crowd.title')}</h2>
                            <p className="text-slate-400 mb-6 h-12">
                                {t('crowd.desc')}
                            </p>
                            <Link
                                to="/crowd"
                                className="inline-flex items-center text-brand-accent hover:text-white font-medium group-hover:translate-x-1 transition-all"
                            >
                                Analyze Footage <ArrowRight className="ml-2 w-4 h-4" />
                            </Link>
                        </div>
                    </motion.div>

                    {/* Missing Person Card */}
                    <motion.div
                        variants={item}
                        whileHover={{ scale: 1.02 }}
                        className="group relative overflow-hidden rounded-2xl bg-slate-900/50 border border-slate-700/50 p-8 hover:border-brand-secondary/50 transition-colors backdrop-blur-md"
                    >
                        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-brand-secondary/10 rounded-full blur-2xl group-hover:bg-brand-secondary/20 transition-all"></div>

                        <div className="relative z-10">
                            <div className="w-12 h-12 bg-default/20 rounded-xl flex items-center justify-center mb-6 text-brand-accent">
                                <Eye className="w-6 h-6" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">{t('missing.title')}</h2>
                            <p className="text-slate-400 mb-6 h-12">
                                {t('missing.desc')}
                            </p>
                            <Link
                                to="/missing-person"
                                className="inline-flex items-center text-brand-accent hover:text-white font-medium group-hover:translate-x-1 transition-all"
                            >
                                Start Search <ArrowRight className="ml-2 w-4 h-4" />
                            </Link>
                        </div>
                    </motion.div>
                </div>

                {/* Features Grid */}
                <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12 border-t border-white/10">
                    <div className="flex items-start space-x-4">
                        <div className="p-2 bg-slate-800/50 rounded-lg backdrop-blur">
                            <Activity className="w-5 h-5 text-brand-accent" />
                        </div>
                        <div>
                            <h3 className="text-white font-medium mb-1">Real-time Processing</h3>
                            <p className="text-sm text-slate-400">Instant analysis of uploaded video feeds.</p>
                        </div>
                    </div>
                    <div className="flex items-start space-x-4">
                        <div className="p-2 bg-slate-800/50 rounded-lg backdrop-blur">
                            <ShieldCheck className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <h3 className="text-white font-medium mb-1">Secure & Private</h3>
                            <p className="text-sm text-slate-400">Data processed locally with strictly controlled access.</p>
                        </div>
                    </div>
                    <div className="flex items-start space-x-4">
                        <div className="p-2 bg-slate-800/50 rounded-lg backdrop-blur">
                            <Users className="w-5 h-5 text-brand-secondary" />
                        </div>
                        <div>
                            <h3 className="text-white font-medium mb-1">Scalable Architecture</h3>
                            <p className="text-sm text-slate-400">Built to handle high-resolution CCTV footage.</p>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </div>
    );
}
