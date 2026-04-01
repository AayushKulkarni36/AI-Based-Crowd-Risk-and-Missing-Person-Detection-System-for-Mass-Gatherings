import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertTriangle, Download, MonitorPlay, Activity } from 'lucide-react';
import UploadCard from '../components/UploadCard';
import SafetyPanel from '../components/SafetyPanel';
import { api, VideoStatus } from '../services/api';
import { useApp } from '../context/AppContext';
import { useTranslation } from '../context/TranslationContext';
import clsx from 'clsx';

export default function CrowdDetection() {
    const { crowdVideos, updateCrowdVideoStatus } = useApp();
    const { t } = useTranslation();

    // Local state for current view, but data persists in context
    const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const pollTimer = useRef<number | null>(null);

    // Restore state if available
    const currentStatus = currentVideoId ? crowdVideos.get(currentVideoId) : null;

    const startPolling = (id: string) => {
        if (pollTimer.current) clearInterval(pollTimer.current);

        pollTimer.current = window.setInterval(async () => {
            try {
                const data = await api.getStatus(id);
                updateCrowdVideoStatus(id, data);

                if (data.status === 'done' || data.status === 'failed') {
                    if (pollTimer.current) clearInterval(pollTimer.current);
                }
            } catch (err) {
                console.error("Poll error", err);
            }
        }, 2000);
    };

    useEffect(() => {
        // Resume polling if we have an active video that isn't done
        if (currentVideoId && currentStatus && currentStatus.status === 'processing') {
            startPolling(currentVideoId);
        }
        return () => {
            if (pollTimer.current) clearInterval(pollTimer.current);
        };
    }, [currentVideoId]); // Re-run only when video ID changes

    const handleUploadComplete = (id: string) => {
        setCurrentVideoId(id);
        const initialStatus: VideoStatus = { ready: false, status: 'processing', video_id: id, found_persons: [], download_url: null };
        updateCrowdVideoStatus(id, initialStatus);
        startPolling(id);
    };

    const isReady = currentStatus?.status === 'done';
    // Mock risk level since backend doesn't return it in JSON yet. In future, parse from data.
    const riskLevel = "Medium";

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">{t('crowd.title')}</h1>
                <p className="text-slate-400">{t('crowd.desc')}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Upload Column */}
                <div className="lg:col-span-1 space-y-6">
                    <UploadCard
                        label={t('upload.title')}
                        onUploadStart={() => setError(null)}
                        onUploadComplete={handleUploadComplete}
                        onUploadError={setError}
                    />

                    {/* Status Panel */}
                    <AnimatePresence>
                        {currentStatus && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, height: 0 }}
                                className="card space-y-4 border-l-4 border-l-brand-primary"
                            >
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-semibold text-white">System Status</h3>
                                    {currentStatus.status === 'processing' && <Loader2 className="w-4 h-4 animate-spin text-brand-accent" />}
                                </div>

                                <div className="flex items-center space-x-3 bg-slate-900/50 p-3 rounded-lg">
                                    <div className={clsx(
                                        "w-3 h-3 rounded-full animate-pulse",
                                        currentStatus.status === 'processing' ? "bg-amber-500" :
                                            currentStatus.status === 'done' ? "bg-emerald-500" : "bg-red-500"
                                    )}></div>
                                    <span className="text-slate-300 capitalize font-medium">
                                        {currentStatus.status === 'processing' ? 'Processing Video...' : currentStatus.status}
                                    </span>
                                </div>

                                {isReady && <SafetyPanel riskLevel={riskLevel} />}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 flex items-center gap-2 backdrop-blur-sm">
                            <AlertTriangle className="w-5 h-5" />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                {/* Results / Viewer Column */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="card min-h-[500px] flex flex-col items-center justify-center p-0 overflow-hidden relative bg-black shadow-2xl shadow-black/50 border-slate-800">
                        {isReady && currentStatus?.download_url ? (
                            <video
                                src={`http://localhost:8000${currentStatus.download_url}`}
                                controls
                                className="w-full h-full object-contain"
                            />
                        ) : (
                            <div className="flex flex-col items-center text-slate-500 space-y-4 p-8">
                                {currentStatus?.status === 'processing' ? (
                                    <>
                                        <div className="relative">
                                            <div className="absolute inset-0 bg-brand-primary/20 blur-xl rounded-full"></div>
                                            <Loader2 className="w-16 h-16 animate-spin text-brand-primary relative z-10" />
                                        </div>
                                        <p className="text-brand-primary font-medium animate-pulse">Analyzing crowd patterns...</p>
                                    </>
                                ) : (
                                    <>
                                        <MonitorPlay className="w-16 h-16 opacity-20" />
                                        <p>Processed output will appear here</p>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Heatmap Overlay Indicator */}
                        {isReady && (
                            <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
                                <Activity className="w-4 h-4 text-brand-secondary" />
                                <span className="text-xs font-medium text-white">Heatmap Active</span>
                            </div>
                        )}
                    </div>

                    {isReady && currentStatus?.download_url && (
                        <div className="flex justify-end">
                            <a
                                href={`http://localhost:8000${currentStatus.download_url}?download=true`}
                                download
                                className="btn-primary"
                            >
                                <Download className="w-4 h-4" /> Download Analyzed Footage
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
