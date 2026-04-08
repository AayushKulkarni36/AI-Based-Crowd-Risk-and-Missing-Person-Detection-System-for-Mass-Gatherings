import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, AlertTriangle, Download, MonitorPlay, Activity,
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

// ── Face Match Card ──────────────────────────────────────────────────────────
function FaceMatchCard({ match }: { match: FaceMatch }) {
  const { pct, cls } = confidenceBadge(match.confidence);
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg"
    >
      <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
        <User className="w-4 h-4 text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm truncate">{match.name}</p>
        <p className="text-xs text-slate-400">Frame #{match.frameNumber}</p>
      </div>
      <span className={clsx('px-2 py-0.5 rounded-full text-xs font-bold border', cls)}>
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
  const pollTimer = useRef<number | null>(null);

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

        // Extract face matches from results if present
        const faceMatches: FaceMatch[] = Array.isArray(data.results?.faceMatches)
          ? (data.results!.faceMatches as any[])
          : [];

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
          if (faceMatches.length > 0) {
            toast.warning(`⚠️ ${faceMatches.length} missing person(s) possibly detected!`);
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
      const faceMatches: FaceMatch[] = Array.isArray((data.results as any)?.faceMatches)
        ? (data.results as any).faceMatches
        : [];
      setState(prev => ({
        ...prev,
        uiStatus: 'completed',
        progress: 100,
        results: data.results,
        faceMatches,
      }));
      stopPolling();
      toast.success('Analysis complete!');
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

  const outputVideoUrl = state.results?.outputVideoPath
    ? `http://localhost:5000/${state.results.outputVideoPath}`
    : null;

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

        {/* ── Right column ─────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card min-h-[500px] flex flex-col items-center justify-center p-0 overflow-hidden relative bg-black shadow-2xl shadow-black/50 border-slate-800">

            {/* Annotated video */}
            {isCompleted && outputVideoUrl ? (
              <video
                key={outputVideoUrl}
                src={outputVideoUrl}
                controls
                autoPlay={false}
                className="w-full h-full object-contain"
                onError={() => toast.error('Video failed to load. Try downloading instead.')}
              />
            ) : (
              <div className="flex flex-col items-center text-slate-500 space-y-4 p-8">
                {isProcessing || isUploading ? (
                  <>
                    <div className="relative">
                      <div className="absolute inset-0 bg-brand-primary/20 blur-xl rounded-full" />
                      <Loader2 className="w-16 h-16 animate-spin text-brand-primary relative z-10" />
                    </div>
                    <p className="text-brand-primary font-medium animate-pulse">
                      {isUploading ? 'Uploading video...' : 'Analyzing crowd patterns & running face matching...'}
                    </p>
                    {isProcessing && state.progress > 0 && (
                      <div className="w-64 bg-slate-800 rounded-full h-1.5">
                        <div
                          className="bg-brand-primary h-1.5 rounded-full transition-all"
                          style={{ width: `${state.progress}%` }}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <MonitorPlay className="w-16 h-16 opacity-20" />
                    <p>Processed output will appear here</p>
                    <p className="text-xs text-slate-600">Upload a video and click Start Analysis</p>
                  </>
                )}
              </div>
            )}

            {isCompleted && (
              <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
                <Activity className="w-4 h-4 text-brand-secondary" />
                <span className="text-xs font-medium text-white">Live Annotation</span>
              </div>
            )}
          </div>

          {/* Download + stats row */}
          {isCompleted && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Stats chips */}
              <div className="flex flex-wrap gap-2">
                {state.results?.totalPeople != null && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 rounded-full text-xs text-slate-300 border border-slate-700">
                    <Eye className="w-3.5 h-3.5" />
                    {state.results.totalPeople} people detected
                  </div>
                )}
                {state.results?.avgPeoplePerFrame != null && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 rounded-full text-xs text-slate-300 border border-slate-700">
                    <TrendingUp className="w-3.5 h-3.5" />
                    {state.results.avgPeoplePerFrame} avg/frame
                  </div>
                )}
                {state.faceMatches.length > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 rounded-full text-xs text-amber-300 border border-amber-500/30">
                    <Brain className="w-3.5 h-3.5" />
                    {state.faceMatches.length} face match{state.faceMatches.length > 1 ? 'es' : ''}
                  </div>
                )}
              </div>

              {/* Download button */}
              {outputVideoUrl && (
                <a
                  href={outputVideoUrl}
                  download
                  className="btn-primary"
                >
                  <Download className="w-4 h-4" />
                  Download Annotated Video
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
