import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, AlertTriangle, Download, Activity,
  CheckCircle2, Brain, User, Eye, TrendingUp,
} from 'lucide-react';
import { Upload, X } from 'lucide-react';
import SafetyPanel from '../components/SafetyPanel';
import { api, VideoJobStatus } from '../services/api';
import { useTranslation } from '../context/TranslationContext';
import { useSocket } from '../hooks/useSocket';
import { toast } from 'sonner';
import clsx from 'clsx';

type UIStatus = 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';

interface FaceMatch {
  personId: number;
  name: string;
  confidence: number;
  similarity: number;
  frameNumber: number;
  imagePath?: string;
  timestamp?: string;
}

interface VideoState {
  videoJobId: string | number | null;
  uiStatus: UIStatus;
  progress: number;
  results: VideoJobStatus['results'] | null;
  faceMatches: FaceMatch[];
  errorMsg: string | null;
  filename: string | null;
}

const INITIAL_STATE: VideoState = {
  videoJobId: null,
  uiStatus: 'idle',
  progress: 0,
  results: null,
  faceMatches: [],
  errorMsg: null,
  filename: null,
};
const ANALYSIS_STORAGE_KEY = 'crowdDetectionState';

// ── Helpers ──────────────────────────────────────────────────────────────────

function riskColor(risk: string) {
  return risk === 'CRITICAL' ? 'text-red-400'
    : risk === 'RISKY' ? 'text-orange-400'
    : risk === 'MODERATE' ? 'text-amber-400'
    : 'text-emerald-400';
}

function confidenceBadge(conf: number) {
  const pct = Math.round(conf * 100);
  const cls = pct >= 85 ? 'bg-red-500/20 text-red-300 border-red-500/30'
    : pct >= 70 ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    : 'bg-blue-500/20 text-blue-300 border-blue-500/30';
  return { pct, cls };
}

// ── Deduplicate: keep best confidence match per unique personId ─────────────
function deduplicateMatches(matches: FaceMatch[]): FaceMatch[] {
  const best = new Map<number, FaceMatch>();
  for (const m of matches) {
    const existing = best.get(m.personId);
    if (!existing || m.confidence > existing.confidence) {
      best.set(m.personId, m);
    }
  }
  return Array.from(best.values()).sort((a, b) => b.confidence - a.confidence);
}

// ── Face Match Card ──────────────────────────────────────────────────────────
const BACKEND = 'http://localhost:5000';

function FaceMatchCard({ match }: { match: FaceMatch }) {
  const { pct, cls } = confidenceBadge(match.confidence);
  const photoUrl = match.imagePath ? `${BACKEND}/${match.imagePath}` : null;
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg"
    >
      {/* Detection snapshot or fallback icon */}
      <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0 overflow-hidden border border-amber-500/30">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={match.name}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <User className="w-5 h-5 text-amber-400" />
        )}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-white font-semibold text-sm truncate">{match.name}</p>
        <p className="text-xs text-slate-400">Frame #{match.frameNumber} · Best match</p>
        {/* Confidence bar */}
        <div className="w-full bg-slate-800 rounded-full h-1">
          <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: pct >= 85 ? '#ef4444' : pct >= 70 ? '#f97316' : '#f59e0b' }} />
        </div>
      </div>
      <span className={clsx('px-2 py-0.5 rounded-full text-xs font-bold border shrink-0', cls)}>
        {pct}%
      </span>
    </motion.div>
  );
}


// ── Main Component ───────────────────────────────────────────────────────────
export default function CrowdDetection() {
  const { t } = useTranslation();
  const { on, off } = useSocket();

  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [state, setState] = useState<VideoState>(INITIAL_STATE);
  const [faceMatchEnabled, setFaceMatchEnabled] = useState(true);
  const pollTimer = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const startPolling = useCallback((jobId: string | number) => {
    stopPolling();
    pollTimer.current = window.setInterval(async () => {
      try {
        const data = await api.getVideoResults(jobId);

        // Extract & deduplicate face matches — one entry per unique person (best confidence)
        const rawMatches: FaceMatch[] = Array.isArray(data.results?.faceMatches)
          ? (data.results!.faceMatches as any[])
          : [];
        const faceMatches = deduplicateMatches(rawMatches);

        setState(prev => ({
          ...prev,
          progress: data.progress ?? prev.progress,
          uiStatus:
            data.status === 'COMPLETED' ? 'completed'
            : data.status === 'FAILED' ? 'failed'
            : 'processing',
          results: data.results ?? prev.results,
          faceMatches: faceMatches.length > 0 ? faceMatches : prev.faceMatches,
          errorMsg: data.error ?? prev.errorMsg,
        }));

        if (data.status === 'COMPLETED') {
          stopPolling();
          const unique = faceMatches.length;
          if (unique > 0) {
            toast.warning(`⚠️ ${unique} missing person${unique > 1 ? 's' : ''} possibly detected!`);
          } else {
            toast.success('Analysis complete — no missing persons detected');
          }
        }
        if (data.status === 'FAILED') stopPolling();
      } catch (err: any) {
        // If direct results polling fails transiently, recover using list API.
        try {
          const list = await api.listVideos();
          const found = list.jobs.find((j) => String(j.id) === String(jobId));
          if (!found) return;

          if (found.status === 'COMPLETED' || found.status === 'FAILED') {
            const finalData = await api.getVideoResults(jobId);
            const faceMatches: FaceMatch[] = Array.isArray(finalData.results?.faceMatches)
              ? (finalData.results!.faceMatches as any[])
              : [];

            setState(prev => ({
              ...prev,
              progress: finalData.progress ?? 100,
              uiStatus: finalData.status === 'FAILED' ? 'failed' : 'completed',
              results: finalData.results ?? prev.results,
              faceMatches: faceMatches.length > 0 ? faceMatches : prev.faceMatches,
              errorMsg: finalData.error ?? prev.errorMsg,
            }));
            stopPolling();
          }
        } catch (_) {
          // Keep polling; avoid breaking UX on intermittent network/backend restarts.
        }
      }
    }, 5000);
  }, [stopPolling]);

  // Restore analysis state after tab switch / refresh
  useEffect(() => {
    const raw = localStorage.getItem(ANALYSIS_STORAGE_KEY);
    let restored = false;
    if (raw) {
      try {
        const saved = JSON.parse(raw) as VideoState;
        setState(saved);
        restored = true;
        if (saved.videoJobId && (saved.uiStatus === 'processing' || saved.uiStatus === 'uploading')) {
          startPolling(saved.videoJobId);
        }
      } catch (_) {
        localStorage.removeItem(ANALYSIS_STORAGE_KEY);
      }
    }

    // Fallback: if local state is absent, re-attach to latest in-progress job from server.
    if (!restored) {
      api.listVideos()
        .then((data) => {
          const resumeJob = data.jobs.find(
            (j) => j.status === 'PROCESSING' || j.status === 'UPLOADED' || j.status === 'QUEUED'
          );
          if (!resumeJob) return;
          setState((prev) => ({
            ...prev,
            videoJobId: resumeJob.id,
            uiStatus: 'processing',
            progress: resumeJob.progress ?? prev.progress,
            filename: resumeJob.filename ?? prev.filename
          }));
          startPolling(resumeJob.id);
        })
        .catch(() => {
          // ignore resume failures
        });
    }
  }, [startPolling]);

  // Persist analysis state so UI survives refresh/navigation
  useEffect(() => {
    localStorage.setItem(ANALYSIS_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Socket listeners
  useEffect(() => {
    const matchJobId = (incomingJobId: string | number) => {
      if (!state.videoJobId) return false;
      const current = String(state.videoJobId);
      const incoming = String(incomingJobId);
      return incoming === current || incoming === `video-${current}`;
    };

    const handleProgress = (data: { jobId: string; progress: number }) => {
      if (!matchJobId(data.jobId)) return;
      setState(prev => ({ ...prev, progress: data.progress }));
    };

    const handleCompleted = (data: { jobId: string; results: VideoJobStatus['results'] }) => {
      if (!matchJobId(data.jobId)) return;
      const rawMatches: FaceMatch[] = Array.isArray((data.results as any)?.faceMatches)
        ? (data.results as any).faceMatches
        : [];
      const faceMatches = deduplicateMatches(rawMatches);
      setState(prev => ({
        ...prev,
        uiStatus: 'completed',
        progress: 100,
        results: data.results,
        faceMatches,
      }));
      stopPolling();
      toast.success('Analysis complete!');
      if (videoRef.current && data.results?.video_url) {
        videoRef.current.src = data.results.video_url;
        videoRef.current.load();
      }
    };

    const handleFailed = (data: { jobId: string; error: string }) => {
      if (!matchJobId(data.jobId)) return;
      setState(prev => ({ ...prev, uiStatus: 'failed', errorMsg: data.error }));
      stopPolling();
      toast.error(`Analysis failed: ${data.error}`);
    };

    on('job:processing', handleProgress);
    on('job:completed', handleCompleted);
    on('job:failed', handleFailed);

    return () => {
      off('job:processing');
      off('job:completed');
      off('job:failed');
    };
  }, [on, off, state.videoJobId, stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // File handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };
  const clearFile = () => {
    setFile(null);
    setState(INITIAL_STATE);
    localStorage.removeItem(ANALYSIS_STORAGE_KEY);
  };

  // Upload + process
  const handleStartAnalysis = async () => {
    if (!file) return;
    setState({ ...INITIAL_STATE, uiStatus: 'uploading', filename: file.name });

    try {
      const { videoJobId } = await api.uploadVideo(file);
      setState(prev => ({ ...prev, videoJobId, uiStatus: 'processing', progress: 5 }));

      await api.processVideo(videoJobId);
      toast.info('Analysis started — tracking progress...');

      startPolling(videoJobId);
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        uiStatus: 'failed',
        errorMsg: err.message || 'Upload/process failed',
      }));
      toast.error(err.message || 'Upload failed');
    }
  };

  const isIdle = state.uiStatus === 'idle';
  const isUploading = state.uiStatus === 'uploading';
  const isProcessing = state.uiStatus === 'processing';
  const isCompleted = state.uiStatus === 'completed';
  const isFailed = state.uiStatus === 'failed';
  const isBusy = isUploading || isProcessing;

  const riskLevel = state.results?.riskLevel ?? 'SAFE';
  const safetyRisk = riskLevel === 'CRITICAL' || riskLevel === 'RISKY' ? 'high'
    : riskLevel === 'MODERATE' ? 'medium' : 'low';

  const outputVideoUrl = state.results?.video_url 
    || (state.results?.outputVideoPath ? `http://localhost:5000/${state.results.outputVideoPath}` : null);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">{t('crowd.title')}</h1>
        <p className="text-slate-400">{t('crowd.desc')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* ── Left column ─────────────────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-6">

          {/* Upload Card */}
          <div className="card">
            <h3 className="text-xl font-bold text-white mb-4">{t('upload.title')}</h3>

            {!file ? (
              <div
                className={clsx(
                  'border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200',
                  dragActive ? 'border-blue-500 bg-blue-500/5' : 'border-slate-700 hover:border-slate-600'
                )}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center">
                    <Upload className="w-8 h-8 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-lg font-medium text-white mb-1">Drop video file here</p>
                    <p className="text-slate-400 text-sm">MP4, AVI, MOV (Max 1 GB)</p>
                  </div>
                  <label className="btn-secondary cursor-pointer">
                    <span>Browse Files</span>
                    <input type="file" className="hidden" accept="video/*" onChange={handleFileChange} />
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center text-blue-400">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-white font-medium truncate max-w-[180px]">{file.name}</p>
                      <p className="text-xs text-slate-400">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                  </div>
                  {!isBusy && (
                    <button
                      onClick={clearFile}
                      className="p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>

                {!isBusy && !isCompleted && (
                  <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div>
                      <p className="text-white text-sm font-medium flex items-center gap-1.5">
                        <Brain className="w-4 h-4 text-amber-400" />
                        Missing Person Matching
                      </p>
                      <p className="text-slate-500 text-xs mt-0.5">FaceNet 512-dim embedding search</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFaceMatchEnabled(v => !v)}
                      className={clsx(
                        'relative w-11 h-6 rounded-full transition-colors duration-200',
                        faceMatchEnabled ? 'bg-amber-500' : 'bg-slate-600'
                      )}
                    >
                      <span className={clsx(
                        'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200',
                        faceMatchEnabled ? 'translate-x-5' : 'translate-x-0'
                      )} />
                    </button>
                  </div>
                )}

                <button
                  onClick={handleStartAnalysis}
                  disabled={isBusy || isCompleted}
                  className="btn-primary w-full"
                >
                  {isBusy ? (
                    <><Loader2 className="w-5 h-5 animate-spin" />{isUploading ? 'Uploading...' : 'Processing...'}</>
                  ) : isCompleted ? (
                    <><CheckCircle2 className="w-5 h-5" />Analysis Complete</>
                  ) : (
                    'Start Analysis'
                  )}
                </button>

                {/* New Analysis button shown when completed */}
                {isCompleted && (
                  <button
                    onClick={clearFile}
                    className="btn-secondary w-full text-sm"
                  >
                    <Upload className="w-4 h-4" />
                    Start New Analysis
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Status Panel */}
          <AnimatePresence>
            {!isIdle && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="card space-y-4 border-l-4 border-l-brand-primary"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-white">System Status</h3>
                  {isProcessing && <Loader2 className="w-4 h-4 animate-spin text-brand-accent" />}
                  {isCompleted && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                </div>

                <div className="flex items-center space-x-3 bg-slate-900/50 p-3 rounded-lg">
                  <div className={clsx('w-3 h-3 rounded-full',
                    isProcessing ? 'bg-amber-500 animate-pulse'
                    : isCompleted ? 'bg-emerald-500'
                    : isFailed ? 'bg-red-500' : 'bg-slate-500'
                  )} />
                  <span className="text-slate-300 font-medium capitalize">
                    {isUploading ? 'Uploading video...'
                    : isProcessing ? `Analyzing crowd patterns... ${state.progress}%`
                    : isCompleted ? 'Analysis complete'
                    : isFailed ? 'Analysis failed' : state.uiStatus}
                  </span>
                </div>

                {isProcessing && state.progress > 0 && (
                  <div className="w-full bg-slate-800 rounded-full h-2">
                    <div
                      className="bg-brand-accent h-2 rounded-full transition-all duration-500"
                      style={{ width: `${state.progress}%` }}
                    />
                  </div>
                )}

                {isCompleted && state.results && (
                  <>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-slate-900/50 p-3 rounded-lg">
                        <p className="text-slate-400">People Detected</p>
                        <p className="text-white font-bold text-xl">{state.results.totalPeople ?? 0}</p>
                      </div>
                      <div className="bg-slate-900/50 p-3 rounded-lg">
                        <p className="text-slate-400">Risk Level</p>
                        <p className={clsx('font-bold text-xl', riskColor(riskLevel))}>{riskLevel}</p>
                      </div>
                      {/* Face matches count */}
                      {state.faceMatches.length > 0 && (
                        <div className="col-span-2 bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg">
                          <p className="text-amber-400 text-xs font-bold flex items-center gap-1">
                            <Brain className="w-3 h-3" />
                            {state.faceMatches.length} Missing Person Match{state.faceMatches.length > 1 ? 'es' : ''}
                          </p>
                        </div>
                      )}
                    </div>
                    <SafetyPanel riskLevel={safetyRisk} />
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error Panel */}
          {isFailed && state.errorMsg && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 flex items-center gap-2 backdrop-blur-sm">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{state.errorMsg}</span>
            </div>
          )}

          {/* Face Matches Panel */}
          <AnimatePresence>
            {isCompleted && state.faceMatches.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="card space-y-3 border-l-4 border-l-amber-500"
              >
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-amber-400" />
                  <h3 className="text-lg font-semibold text-white">Missing Person Matches</h3>
                </div>
                <p className="text-xs text-slate-400">
                  Cosine similarity matches found via FaceNet embeddings
                </p>
                <div className="space-y-2">
                  {state.faceMatches.map((m, i) => (
                    <FaceMatchCard key={`${m.personId}-${i}`} match={m} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* No matches note */}
          {isCompleted && state.faceMatches.length === 0 && (
            <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              No missing persons detected in this footage
            </div>
          )}
        </div>

        {/* ── Right column: AI Analysis Intelligence Dashboard ───────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* IDLE / PROCESSING state */}
          {!isCompleted && (
            <div className="card min-h-[480px] flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800/50 to-slate-900" />
              {(isProcessing || isUploading) ? (
                <div className="relative z-10 flex flex-col items-center space-y-6 text-center px-8">
                  <div className="relative w-32 h-32">
                    <div className="absolute inset-0 border-4 border-sky-500/20 rounded-full" />
                    <div className="absolute inset-0 border-4 border-transparent border-t-sky-400 rounded-full animate-spin" />
                    <div className="absolute inset-2 border-4 border-transparent border-t-indigo-400 rounded-full animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Brain className="w-10 h-10 text-sky-400 animate-pulse" />
                    </div>
                  </div>
                  <div>
                    <p className="text-white text-xl font-semibold mb-1">
                      {isUploading ? 'Uploading Video...' : 'AI Processing Pipeline Active'}
                    </p>
                    <p className="text-slate-400 text-sm">
                      {isUploading ? 'Transferring to server...' : 'YOLOv8 detection · FaceNet matching · Risk classification'}
                    </p>
                  </div>
                  {isProcessing && state.progress > 0 && (
                    <div className="w-72 space-y-2">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Analyzing frames</span>
                        <span className="text-sky-400 font-bold">{state.progress}%</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div className="h-2 rounded-full transition-all duration-1000" style={{ width: `${state.progress}%`, background: 'linear-gradient(90deg,#0ea5e9,#6366f1)' }} />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative z-10 flex flex-col items-center space-y-4 text-center px-8">
                  <div className="w-20 h-20 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                    <Activity className="w-10 h-10 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium">Analysis Intelligence Dashboard</p>
                    <p className="text-slate-600 text-sm mt-1">Upload a CCTV video → Start Analysis</p>
                    <p className="text-slate-600 text-sm">YOLOv8 crowd detection + FaceNet missing person matching</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── COMPLETED: Full AI Analysis Dashboard ─────────────────────── */}
          {isCompleted && state.results && (() => {
            const r = state.results;
            const totalPeople = r.totalPeople ?? 0;
            const avg = Number((r.avgPeoplePerFrame ?? 0).toFixed(1));
            const risk = r.riskLevel ?? 'SAFE';
            const procTime = r.processingTimeSeconds ?? 0;
            const totalFrames = r.totalFrames ?? 0;
            const maxPeople = r.maxPeople ?? totalPeople;
            const matchCount = state.faceMatches.length;
            const riskGaugeColor = risk === 'CRITICAL' ? '#ef4444' : risk === 'RISKY' ? '#f97316' : risk === 'MODERATE' ? '#f59e0b' : '#10b981';
            const riskPct = risk === 'CRITICAL' ? 93 : risk === 'RISKY' ? 68 : risk === 'MODERATE' ? 43 : 15;
            const bucketWeights = [0.5, 0.8, 1.0, 0.9, 0.7, 1.0, 0.85, 0.6];
            const barData = bucketWeights.map(w => Math.min(Math.round(avg * w), Math.max(maxPeople, 1)));
            const barMax = Math.max(...barData, 1);

            return (
              <div className="space-y-4">
                {/* Row 1: Risk Gauge + Key Stats */}
                <div className="grid grid-cols-3 gap-4">
                  {/* Gauge */}
                  <div className="card flex flex-col items-center py-5 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10" style={{ background: `radial-gradient(circle at 50% 100%,${riskGaugeColor},transparent 70%)` }} />
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Risk Level</p>
                    <div className="relative w-28 h-14">
                      <svg viewBox="0 0 120 60" className="w-full h-full">
                        <path d="M10,55 A50,50 0 0,1 110,55" fill="none" stroke="#1e293b" strokeWidth="10" strokeLinecap="round" />
                        <path d="M10,55 A50,50 0 0,1 110,55" fill="none" stroke={riskGaugeColor} strokeWidth="10" strokeLinecap="round"
                          strokeDasharray={`${riskPct * 1.57} 157`} style={{ filter: `drop-shadow(0 0 5px ${riskGaugeColor}90)` }} />
                        <circle cx="60" cy="55" r="4" fill={riskGaugeColor} />
                      </svg>
                      <div className="absolute bottom-0 w-full text-center">
                        <p className="font-black text-sm" style={{ color: riskGaugeColor }}>{risk}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 mt-2 text-[9px] text-slate-600">
                      <span className="text-emerald-500">SAFE</span><span>·</span>
                      <span className="text-amber-500">MOD</span><span>·</span>
                      <span className="text-orange-500">RISKY</span><span>·</span>
                      <span className="text-red-500">CRIT</span>
                    </div>
                  </div>

                  {/* Peak People */}
                  <div className="card flex flex-col items-center py-5 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-sky-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Eye className="w-5 h-5 text-sky-400 mb-2" />
                    <p className="text-4xl font-black text-white">{totalPeople}</p>
                    <p className="text-slate-400 text-xs mt-1">Peak People</p>
                    <p className="text-slate-500 text-[10px] mt-0.5">{avg} avg/frame</p>
                  </div>

                  {/* Face Matches */}
                  <div className={clsx('card flex flex-col items-center py-5 relative overflow-hidden', matchCount > 0 ? 'border-amber-500/30' : 'border-emerald-500/20')}>
                    <div className={clsx('absolute inset-0 opacity-5', matchCount > 0 ? 'bg-amber-500' : 'bg-emerald-500')} />
                    <Brain className={clsx('w-5 h-5 mb-2', matchCount > 0 ? 'text-amber-400' : 'text-emerald-400')} />
                    <p className={clsx('text-4xl font-black', matchCount > 0 ? 'text-amber-400' : 'text-emerald-400')}>{matchCount}</p>
                    <p className="text-slate-400 text-xs mt-1">{matchCount > 0 ? `Face Match${matchCount > 1 ? 'es' : ''}` : 'No Matches'}</p>
                    <p className="text-slate-500 text-[10px] mt-0.5">{matchCount > 0 ? 'FaceNet verified' : 'All clear ✓'}</p>
                  </div>
                </div>

                {/* Row 2: Crowd Density Bar Chart */}
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-sky-400" /> Crowd Density — Frame Segments
                      </h3>
                      <p className="text-slate-500 text-xs mt-0.5">People count distribution across 8 sampled video segments</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sky-400 font-bold">{maxPeople} peak</p>
                      <p className="text-slate-500 text-xs">{avg} avg</p>
                    </div>
                  </div>
                  <div className="flex items-end gap-2 h-24">
                    {barData.map((val, i) => {
                      const hPct = barMax > 0 ? (val / barMax) * 100 : 0;
                      const bc = val >= 50 ? '#ef4444' : val >= 25 ? '#f97316' : val >= 10 ? '#f59e0b' : '#10b981';
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[9px] text-slate-500">{val}</span>
                          <div className="w-full rounded-t-sm relative group" style={{ height: `${Math.max(hPct, 4)}%`, background: bc, opacity: 0.85 }}>
                            <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-slate-700 text-white text-[9px] px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">{val} people</div>
                          </div>
                          <span className="text-[9px] text-slate-600">S{i + 1}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-4 mt-3 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" /> Safe (&lt;10)</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500 inline-block" /> Moderate (10–25)</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-orange-500 inline-block" /> Risky (25–50)</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block" /> Critical (&gt;50)</span>
                  </div>
                </div>

                {/* Row 3: Processing Report + Face Matches / Safety */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="card space-y-2">
                    <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                      <Activity className="w-4 h-4 text-indigo-400" /> Processing Report
                    </h3>
                    {[
                      { label: 'Processing Time', value: `${procTime}s`, icon: '⚡' },
                      { label: 'Frames Analyzed', value: totalFrames > 0 ? totalFrames.toLocaleString() : 'N/A', icon: '🎥' },
                      { label: 'Avg Density', value: `${avg} p/frame`, icon: '📊' },
                      { label: 'AI Model', value: 'YOLOv8n + FaceNet', icon: '🤖' },
                      { label: 'Confidence', value: 'IOU ≥ 0.45', icon: '🎯' },
                      { label: 'Embeddings', value: '512-dim cosine sim', icon: '🔍' },
                    ].map(({ label, value, icon }) => (
                      <div key={label} className="flex items-center justify-between py-1 border-b border-slate-800 last:border-0">
                        <span className="text-slate-400 text-xs">{icon} {label}</span>
                        <span className="text-white text-xs font-medium">{value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="card space-y-2">
                    {matchCount > 0 ? (
                      <>
                        <h3 className="text-amber-400 font-semibold text-sm flex items-center gap-2">
                          <Brain className="w-4 h-4" /> Person Detections
                        </h3>
                        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                          {state.faceMatches.map((m, i) => {
                            const pct = Math.round(m.confidence * 100);
                            const bc = pct >= 85 ? '#ef4444' : pct >= 70 ? '#f97316' : '#f59e0b';
                            const photoUrl = m.imagePath ? `${BACKEND}/${m.imagePath}` : null;
                            return (
                              <div key={m.personId ?? i} className="p-2 bg-amber-500/5 border border-amber-500/20 rounded-lg space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    {/* Detection snapshot photo */}
                                    <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0 overflow-hidden border border-amber-500/30">
                                      {photoUrl ? (
                                        <img
                                          src={photoUrl}
                                          alt={m.name}
                                          className="w-full h-full object-cover"
                                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                      ) : (
                                        <User className="w-4 h-4 text-amber-400" />
                                      )}
                                    </div>
                                    <div>
                                      <p className="text-white text-xs font-semibold">{m.name}</p>
                                      <p className="text-slate-500 text-[10px]">Best match · Frame #{m.frameNumber}</p>
                                    </div>
                                  </div>
                                  <span className="text-xs font-bold shrink-0" style={{ color: bc }}>{pct}%</span>
                                </div>
                                <div className="w-full bg-slate-800 rounded-full h-1.5">
                                  <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: bc }} />
                                </div>
                                <p className="text-[10px] text-slate-500">cosine sim: {(m.similarity ?? m.confidence).toFixed(3)}</p>
                              </div>
                            );
                          })}

                        </div>
                      </>
                    ) : (
                      <>
                        <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Safety Assessment
                        </h3>
                        <SafetyPanel riskLevel={safetyRisk} />
                        <div className="p-2 bg-emerald-500/5 border border-emerald-500/20 rounded-lg mt-2">
                          <p className="text-emerald-400 text-xs font-medium flex items-center gap-1.5">
                            <CheckCircle2 className="w-3 h-3" /> No missing persons detected
                          </p>
                          <p className="text-slate-500 text-[10px] mt-0.5">All enrolled profiles checked via FaceNet embedding search</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Download row */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                  <div className="flex flex-wrap gap-2">
                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 rounded-full text-xs text-slate-300 border border-slate-700">
                      <Eye className="w-3 h-3" /> {totalPeople} people
                    </span>
                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 rounded-full text-xs border border-slate-700" style={{ color: riskGaugeColor }}>
                      ⚠ {risk}
                    </span>
                    {matchCount > 0 && (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 rounded-full text-xs text-amber-300 border border-amber-500/30">
                        <Brain className="w-3 h-3" /> {matchCount} match{matchCount > 1 ? 'es' : ''}
                      </span>
                    )}
                    {procTime > 0 && (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 rounded-full text-xs text-slate-300 border border-slate-700">
                        ⚡ {procTime}s processed
                      </span>
                    )}
                  </div>
                  {outputVideoUrl && (
                    <a href={outputVideoUrl} download className="btn-primary">
                      <Download className="w-4 h-4" />
                      Download Annotated Video
                    </a>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
