import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Search, CheckCircle } from 'lucide-react';
import UploadCard from '../components/UploadCard';
import { api, VideoStatus } from '../services/api';
import clsx from 'clsx';
import { useApp } from '../context/AppContext';
import { useTranslation } from '../context/TranslationContext';

export default function MissingPerson() {
    const {
        activePersonVideos,
        updatePersonVideoStatus,
        registeredPersons,
        refreshPersons
    } = useApp();
    const { t } = useTranslation();

    // Local state for UI toggles
    const [showRegForm, setShowRegForm] = useState(false);
    const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);

    // We derive alerts from the current status
    const currentStatus = currentVideoId ? activePersonVideos.get(currentVideoId) : null;

    const pollTimer = useRef<number | null>(null);

    const startPolling = (id: string) => {
        if (pollTimer.current) clearInterval(pollTimer.current);

        pollTimer.current = window.setInterval(async () => {
            try {
                const data = await api.getVideoResults(parseInt(id));
                updatePersonVideoStatus(id, data);

                if (data.status === 'COMPLETED' || data.status === 'FAILED') {
                    if (pollTimer.current) clearInterval(pollTimer.current);
                    if (data.status === 'COMPLETED') refreshPersons();
                }
            } catch (err) {
                console.error(err);
            }
        }, 2000);
    };

    useEffect(() => {
        // Resume polling if active
        if (currentVideoId && currentStatus && currentStatus.status === 'PROCESSING') {
            startPolling(currentVideoId);
        }
        return () => {
            if (pollTimer.current) clearInterval(pollTimer.current);
        };
    }, [currentVideoId]);

    const handleVideoUpload = (id: string) => {
        setCurrentVideoId(id);
        const initial: VideoStatus = {
            success: true,
            status: 'PROCESSING',
            progress: 0
        };
        updatePersonVideoStatus(id, initial);
        startPolling(id);
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">{t('missing.title')}</h1>
                    <p className="text-slate-400">{t('missing.desc')}</p>
                </div>
                <button
                    onClick={() => setShowRegForm(!showRegForm)}
                    className={clsx("btn-primary", showRegForm && "!bg-slate-700 !from-slate-700 !to-slate-700")}
                >
                    <UserPlus className="w-5 h-5" />
                    {showRegForm ? 'Cancel Registration' : 'Register New Person'}
                </button>
            </div>

            {/* Registration Form (Collapsible) */}
            <AnimatePresence>
                {showRegForm && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <RegistrationForm onSuccess={() => {
                            setShowRegForm(false);
                            refreshPersons();
                        }} />
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* LEFT: Analysis + Active List */}
                <div className="lg:col-span-1 space-y-6">
                    <h3 className="text-lg font-semibold text-white px-2">1. Upload Footage</h3>
                    <UploadCard
                        label={t('upload.title')}
                        onUploadStart={() => { }}
                        onUploadComplete={handleVideoUpload}
                        onUploadError={alert}
                    />

                    <div className="h-px bg-white/10 my-4" />

                    <div className="card max-h-[400px] overflow-y-auto">
                        <h3 className="text-white font-semibold mb-4 sticky top-0 bg-slate-900/90 p-2 -mx-2 -mt-2 backdrop-blur z-10">
                            Tracking Registry ({registeredPersons.length})
                        </h3>
                        {registeredPersons.length === 0 ? (
                            <p className="text-slate-500 text-sm">No active missing persons.</p>
                        ) : (
                            <ul className="space-y-3">
                                {registeredPersons.map(p => (
                                    <li key={p.id} className="group flex items-center space-x-3 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-default border border-transparent hover:border-white/5">
                                        <div className="w-10 h-10 rounded-full bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center border border-slate-700">
                                            <span className="text-slate-500 font-bold group-hover:text-brand-primary transition-colors">{p.name.charAt(0)}</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-white group-hover:text-brand-primary transition-colors">{p.name}</p>
                                            <p className="text-xs text-slate-400">{p.gender}, {p.age}y</p>
                                        </div>
                                        {p.status === 'FOUND' && <CheckCircle className="w-4 h-4 text-emerald-500 ml-auto" />}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* RIGHT: Results Area */}
                <div className="lg:col-span-2 space-y-6">
                    <h3 className="text-lg font-semibold text-white px-2">2. Live Analysis Results</h3>

                    {/* PROGRESS / STATUS DISPLAY */}
                    <AnimatePresence>
                        {currentStatus && currentStatus.status === 'PROCESSING' && (
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="bg-blue-500/20 border border-blue-500 rounded-xl p-6 flex items-center gap-4 backdrop-blur-md"
                            >
                                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20 animate-spin">
                                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white mb-1">Processing Video</h2>
                                    <p className="text-blue-200 text-sm">
                                        Progress: {currentStatus.progress || 0}%
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Video Player Area */}
                    <div className="card min-h-[500px] flex flex-col justify-center items-center bg-black relative p-0 overflow-hidden shadow-2xl border-slate-800">
                        {currentStatus?.status === 'COMPLETED' && currentStatus.results?.outputVideoPath ? (
                            <video
                                src={`http://localhost:5000/results/${currentStatus.results.outputVideoPath.split('/').pop()}`}
                                controls
                                className="w-full h-full object-contain"
                            />
                        ) : (
                            <div className="flex flex-col items-center text-slate-500 space-y-4">
                                {currentStatus?.status === 'PROCESSING' ? (
                                    <div className="text-center relative">
                                        <div className="absolute inset-0 bg-brand-primary/20 blur-xl rounded-full"></div>
                                        <div className="w-16 h-16 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto mb-4 relative z-10" />
                                        <p className="text-brand-primary font-medium">Analyzing video...</p>
                                        <p className="text-sm">Detecting people and generating analysis</p>
                                    </div>
                                ) : (
                                    <>
                                        <Search className="w-16 h-16 opacity-20" />
                                        <p>Waiting for video input...</p>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Results Summary */}
                    {currentStatus?.status === 'COMPLETED' && currentStatus.results && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="card">
                                <p className="text-slate-400 text-sm">Total People Detected</p>
                                <p className="text-2xl font-bold text-white">{currentStatus.results.totalPeople || 0}</p>
                            </div>
                            <div className="card">
                                <p className="text-slate-400 text-sm">Risk Level</p>
                                <p className={`text-2xl font-bold ${currentStatus.results.riskLevel === 'CRITICAL' ? 'text-red-500' :
                                        currentStatus.results.riskLevel === 'RISKY' ? 'text-orange-500' :
                                            currentStatus.results.riskLevel === 'MODERATE' ? 'text-yellow-500' :
                                                'text-green-500'
                                    }`}>
                                    {currentStatus.results.riskLevel || 'UNKNOWN'}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function RegistrationForm({ onSuccess }: { onSuccess: () => void }) {
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        try {
            const fd = new FormData(e.currentTarget);
            await api.registerMissingPerson(fd);
            alert("Person registered successfully!");
            onSuccess();
        } catch (err: any) {
            alert("Error: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card border-l-4 border-l-brand-primary bg-slate-900/80">
            <h3 className="text-lg font-bold text-white mb-4">New Entry Registration</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input name="name" placeholder="Full Name" required className="input-field" />
                <input name="age" type="number" placeholder="Age" required className="input-field" />
                <select name="gender" className="input-field">
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                </select>
                <input name="contact_info" placeholder="Emergency Contact" className="input-field" />
                <textarea name="description" placeholder="Physical Description" className="input-field md:col-span-2" rows={2} />
                <div className="md:col-span-2">
                    <label className="block text-sm text-slate-400 mb-1">Reference Photo (Clear face required)</label>
                    <input name="photo" type="file" required accept="image/*" className="input-field py-1 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-primary/10 file:text-brand-primary hover:file:bg-brand-primary/20" />
                </div>
                <div className="md:col-span-2 flex justify-end">
                    <button disabled={loading} className="btn-primary w-full md:w-auto">
                        {loading ? 'Registering...' : 'Add to Database'}
                    </button>
                </div>
            </form>
        </div>
    );
}
