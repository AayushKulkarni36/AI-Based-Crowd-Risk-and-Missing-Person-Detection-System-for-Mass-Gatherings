import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertTriangle, Download, MonitorPlay, Activity, CheckCircle2 } from 'lucide-react';
import { Upload, X } from 'lucide-react';
import SafetyPanel from '../components/SafetyPanel';
import { api, VideoJobStatus } from '../services/api';
import { useTranslation } from '../context/TranslationContext';
import { useSocket } from '../hooks/useSocket';
import { toast } from 'sonner';
import clsx from 'clsx';

type UIStatus = 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';

interface VideoState {
  videoJobId: number | null;
  uiStatus: UIStatus;
  progress: number;
  results: VideoJobStatus['results'] | null;
  errorMsg: string | null;
  filename: string | null;
}

const INITIAL_STATE: VideoState = {
  videoJobId: null,
  uiStatus: 'idle',
  progress: 0,
  results: null,
  errorMsg: null,
  filename: null,
};

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

  const startPolling = useCallback((jobId: number) => {
    stopPolling();
    pollTimer.current = window.setInterval(async () => {
      try {
        const data = await api.getVideoResults(jobId);
        setState(prev => ({
          ...prev,
          progress: data.progress ?? prev.progress,
          uiStatus: data.status === 'COMPLETED' ? 'completed'
            : data.status === 'FAILED' ? 'failed'
            : 'processing',
          results: data.results ?? prev.results,
          errorMsg: data.error ?? prev.errorMsg,
        }));
        if (data.status === 'COMPLETED' || data.status === 'FAILED') {
          stopPolling();
        }
      } catch (err: any) {
        // Keep polling; transient network error
      }
    }, 3000);
  }, [stopPolling]);

  // ── Socket listeners (real-time updates) ────────────────────────────────
  useEffect(() => {
    const handleProgress = (data: { jobId: string; progress: number }) => {
      const numericJobId = state.videoJobId ? `video-${state.videoJobId}` : null;
      if (!numericJobId || data.jobId !== numericJobId) return;
      setState(prev => ({ ...prev, progress: data.progress }));
    };

    const handleCompleted = (data: { jobId: string; results: VideoJobStatus['results'] }) => {
      const numericJobId = state.videoJobId ? `video-${state.videoJobId}` : null;
      if (!numericJobId || data.jobId !== numericJobId) return;
      setState(prev => ({
        ...prev,
        uiStatus: 'completed',
        progress: 100,
        results: data.results,
      }));
      stopPolling();
      toast.success('Analysis complete!');
    };

    const handleFailed = (data: { jobId: string; error: string }) => {
      const numericJobId = state.videoJobId ? `video-${state.videoJobId}` : null;
      if (!numericJobId || data.jobId !== numericJobId) return;
      setState(prev => ({
        ...prev,
        uiStatus: 'failed',
        errorMsg: data.error,
      }));
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

  // Cleanup timers on unmount
  useEffect(() => () => stopPolling(), [stopPolling]);

  // ── File handlers ─────────────────────────────────────────────────────────
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
  };

  // ── Upload + process ──────────────────────────────────────────────────────
  const handleStartAnalysis = async () => {
    if (!file) return;
    setState({ ...INITIAL_STATE, uiStatus: 'uploading', filename: file.name });

    try {
      // Step 1: Upload
      const { videoJobId } = await api.uploadVideo(file);
      setState(prev => ({ ...prev, videoJobId, uiStatus: 'processing', progress: 5 }));

      // Step 2: Enqueue
      await api.processVideo(videoJobId);
      toast.info('Analysis started — tracking progress...');

      // Step 3: Poll as fallback (socket handles primary)
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
  const safetyRisk = riskLevel === 'CRITICAL' ? 'high' : riskLevel === 'RISKY' ? 'high' : riskLevel === 'MODERATE' ? 'medium' : 'low';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">{t('crowd.title')}</h1>
        <p className="text-slate-400">{t('crowd.desc')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upload Column */}
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
                    isProcessing ? 'bg-amber-500 animate-pulse' :
                    isCompleted ? 'bg-emerald-500' :
                    isFailed ? 'bg-red-500' : 'bg-slate-500'
                  )} />
                  <span className="text-slate-300 font-medium capitalize">
                    {isUploading ? 'Uploading video...' :
                     isProcessing ? `Analyzing crowd patterns... ${state.progress}%` :
                     isCompleted ? 'Analysis complete' :
                     isFailed ? 'Analysis failed' : state.uiStatus}
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
                        <p className={clsx('font-bold text-xl',
                          riskLevel === 'CRITICAL' ? 'text-red-400' :
                          riskLevel === 'RISKY' ? 'text-orange-400' :
                          riskLevel === 'MODERATE' ? 'text-amber-400' : 'text-emerald-400'
                        )}>{riskLevel}</p>
                      </div>
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
        </div>

        {/* Results Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card min-h-[500px] flex flex-col items-center justify-center p-0 overflow-hidden relative bg-black shadow-2xl shadow-black/50 border-slate-800">
            {isCompleted && state.results?.outputVideoPath ? (
              <video
                src={`http://localhost:5000/${state.results.outputVideoPath}`}
                controls
                className="w-full h-full object-contain"
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
                      {isUploading ? 'Uploading video...' : 'Analyzing crowd patterns...'}
                    </p>
                  </>
                ) : (
                  <>
                    <MonitorPlay className="w-16 h-16 opacity-20" />
                    <p>Processed output will appear here</p>
                  </>
                )}
              </div>
            )}

            {isCompleted && (
              <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
                <Activity className="w-4 h-4 text-brand-secondary" />
                <span className="text-xs font-medium text-white">Heatmap Active</span>
              </div>
            )}
          </div>

          {isCompleted && state.results?.outputVideoPath && (
            <div className="flex justify-end">
              <a
                href={`http://localhost:5000/${state.results.outputVideoPath}`}
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
