import { useState, useRef, useEffect } from 'react';
import { Upload, X, CheckCircle, TrendingUp, Users, AlertTriangle, Download } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { api } from '../services/api';

export default function VideoAnalysis() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [foundAlerts, setFoundAlerts] = useState([]);
  const pollingRef = useRef(null);

  const resetPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUploadAndProcess = async () => {
    if (!file) return;

    resetPolling();
    setUploading(true);
    setProcessing(false);
    setError(null);
    setResults(null);
    setFoundAlerts([]);

    try {
      const formData = new FormData();
      formData.append('video', file);

      const { data } = await api.uploadVideo(formData);
      const videoId = data.video_id; // Python returns snake_case 'video_id'

      setUploading(false);
      setProcessing(true);

      pollingRef.current = setInterval(async () => {
        try {
          const res = await api.getVideoResults(videoId);
          const statusData = res.data;

          // Check for alerts
          if (statusData.found_persons && statusData.found_persons.length > 0) {
            const newNames = statusData.found_persons.map(p => p.name);
            setFoundAlerts(prev => [...new Set([...prev, ...newNames])]);
          }

          if (statusData.status === 'done') {
            console.log('=== PROCESSING COMPLETE ===', statusData);
            setResults({
              totalPeople: "N/A", // Backend doesn't compute aggregate stats yet
              avgDensity: 0,
              riskLevel: "SAFE",
              processedVideo: statusData.download_url
            });
            setProcessing(false);
            resetPolling();
          } else if (statusData.status === 'failed') {
            setError('Processing failed: ' + statusData.error);
            setProcessing(false);
            resetPolling();
          }
        } catch (pollError) {
          console.error('Error polling results:', pollError);
        }
      }, 2000);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Upload failed');
      setUploading(false);
      setProcessing(false);
      resetPolling();
    }
  };

  const handleRemoveFile = () => {
    resetPolling();
    setFile(null);
    setResults(null);
    setError(null);
    setUploading(false);
    setProcessing(false);
  };

  useEffect(() => () => resetPolling(), []);

  useEffect(() => {
    if (results) {
      console.log('=== FRONTEND: Results State Updated ===');
      console.log('Current Results State:', results);
      console.log('FPS Fields in State:', {
        averageFPS: results.averageFPS,
        minFPS: results.minFPS,
        maxFPS: results.maxFPS,
        fpsRating: results.fpsRating
      });
    }
  }, [results]);

  const getRiskConfig = (level) => {
    const configs = {
      SAFE: {
        color: 'emerald',
        icon: CheckCircle,
        label: 'Safe',
        description: 'Occupancy within normal limits'
      },
      MODERATE: {
        color: 'amber',
        icon: AlertTriangle,
        label: 'Moderate',
        description: 'Approaching maximum capacity'
      },
      RISKY: {
        color: 'orange',
        icon: AlertTriangle,
        label: 'Risky',
        description: 'Near capacity limit'
      },
      CRITICAL: {
        color: 'red',
        icon: AlertTriangle,
        label: 'Critical',
        description: 'CRITICAL OVERCROWDING'
      }
    };
    return configs[level] || configs.SAFE;
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Video Analysis</h1>
        <p className="text-slate-400 text-lg">Upload a video to analyze crowd density and assess risk levels</p>
      </div>

      {/* Upload Section */}
      <div className="premium-card p-8">
        {!file ? (
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 ${dragActive
              ? 'border-blue-500 bg-blue-500/5'
              : 'border-slate-700 hover:border-slate-600'
              }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center space-y-4">
              <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center">
                <Upload className="w-10 h-10 text-slate-400" />
              </div>
              <div>
                <p className="text-xl font-semibold text-white mb-2">Drop your video here</p>
                <p className="text-slate-400">or click to browse (MP4, AVI, MOV up to 100MB)</p>
              </div>
              <input
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="hidden"
                id="video-upload"
              />
              <label htmlFor="video-upload" className="btn-premium cursor-pointer">
                Choose Video File
              </label>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between p-6 bg-slate-900/50 rounded-xl">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center">
                <Upload className="w-8 h-8 text-white" />
              </div>
              <div>
                <p className="text-white font-semibold text-lg">{file.name}</p>
                <p className="text-slate-400">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>
            </div>
            <button
              onClick={handleRemoveFile}
              className="w-10 h-10 bg-slate-800 hover:bg-red-600 rounded-lg flex items-center justify-center transition-all"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        )}

        {file && !uploading && !processing && !results && (
          <div className="mt-6">
            <button onClick={handleUploadAndProcess} className="btn-premium w-full text-lg py-4">
              🚀 Analyze Video
            </button>
          </div>
        )}
      </div>

      {/* Loading States */}
      {(uploading || processing) && (
        <div className="premium-card p-12">
          <LoadingSpinner
            message={uploading ? 'Uploading video...' : 'Processing video with YOLOv5...'}
          />
        </div>
      )}

      {/* Found Persons Alert */}
      {foundAlerts.length > 0 && (
        <div className="premium-card p-6 bg-red-500/20 border-red-500 animate-pulse">
          <h3 className="text-xl font-bold text-red-500 flex items-center mb-2">
            <AlertTriangle className="w-6 h-6 mr-2" />
            MISSING PERSON DETECTED!
          </h3>
          <p className="text-white text-lg">
            Identity Matched: <span className="font-bold">{foundAlerts.join(", ")}</span>
          </p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="premium-card p-6 bg-red-500/10 border-red-500/50">
          <p className="text-red-400 flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5" />
            <span>{error}</span>
          </p>
        </div>
      )}

      {/* Results Display */}
      {results && (
        <div className="space-y-6">
          {/* Main Results Card */}
          <div className="premium-card p-8">
            <h2 className="text-2xl font-bold text-white mb-6">Detection Results</h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Users className="w-8 h-8 text-white" />
                </div>
                <p className="text-5xl font-bold text-white mb-2">{results.totalPeople}</p>
                <p className="text-slate-400 font-medium">People Detected</p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <TrendingUp className="w-8 h-8 text-white" />
                </div>
                <p className="text-5xl font-bold text-white mb-2">{results.avgDensity?.toFixed(1) || 0}</p>
                <p className="text-slate-400 font-medium">Avg Density/Frame</p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
                <p className="text-5xl font-bold text-white mb-2">{results.occupancy || 0}%</p>
                <p className="text-slate-400 font-medium">Occupancy</p>
              </div>

              <div className="text-center">
                {(() => {
                  const config = getRiskConfig(results.riskLevel);
                  const Icon = config.icon;
                  const colorMap = {
                    emerald: 'from-emerald-500 to-emerald-600',
                    amber: 'from-amber-500 to-amber-600',
                    orange: 'from-orange-500 to-orange-600',
                    red: 'from-red-500 to-red-600'
                  };
                  return (
                    <>
                      <div className={`w-16 h-16 bg-gradient-to-br ${colorMap[config.color]} rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg`}>
                        <Icon className="w-8 h-8 text-white" />
                      </div>
                      <p className="text-5xl font-bold text-white mb-2">{config.label}</p>
                      <p className="text-slate-400 font-medium">Risk Level</p>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Performance Metrics Card */}
          {results && (
            <div className="premium-card p-6">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <span>Performance Metrics</span>
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {/* Average FPS */}
                <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-800">
                  <p className="text-slate-400 text-sm mb-1">Average FPS</p>
                  <p className="text-3xl font-bold text-white">
                    {results.averageFPS !== undefined && results.averageFPS !== null
                      ? Number(results.averageFPS).toFixed(1)
                      : 'N/A'}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">frames per second</p>
                </div>

                {/* Performance Rating */}
                <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-800">
                  <p className="text-slate-400 text-sm mb-1">Performance Rating</p>
                  <p
                    className={`text-lg font-semibold ${results.averageFPS >= 20
                      ? 'text-green-400'
                      : results.averageFPS >= 15
                        ? 'text-yellow-400'
                        : results.averageFPS >= 10
                          ? 'text-orange-400'
                          : 'text-red-400'
                      }`}
                  >
                    {results.fpsRating || 'N/A'}
                  </p>
                </div>
              </div>

              {/* FPS Range */}
              <div className="mt-3 text-sm text-slate-400">
                FPS Range:{' '}
                {results.minFPS !== undefined && results.minFPS !== null
                  ? Number(results.minFPS).toFixed(1)
                  : 'N/A'}{' '}
                -{' '}
                {results.maxFPS !== undefined && results.maxFPS !== null
                  ? Number(results.maxFPS).toFixed(1)
                  : 'N/A'}
              </div>

              {/* Debug Info (Remove after testing) */}
              <div className="mt-3 p-2 bg-slate-800/50 rounded text-xs text-slate-500">
                Debug: avgFPS={JSON.stringify(results.averageFPS)} | rating={JSON.stringify(results.fpsRating)}
              </div>
            </div>
          )}

          {/* Recommendations */}
          <div className="premium-card p-8">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center space-x-2">
              <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <span>Recommendations</span>
            </h3>
            <ul className="space-y-3">
              {results.suggestions?.map((suggestion, idx) => (
                <li key={idx} className="flex items-start space-x-3 text-slate-300">
                  <span className="text-blue-500 text-xl">- </span>
                  <span className="text-lg">{suggestion}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Processed Video */}
          {results.processedVideo && (
            <div className="premium-card p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Processed Video</h3>
                <a
                  href={`http://localhost:8000${results.processedVideo}`}
                  download
                  className="btn-secondary flex items-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </a>
              </div>
              <video
                className="w-full rounded-xl bg-slate-900"
                controls
                src={`http://localhost:8000${results.processedVideo}`}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
