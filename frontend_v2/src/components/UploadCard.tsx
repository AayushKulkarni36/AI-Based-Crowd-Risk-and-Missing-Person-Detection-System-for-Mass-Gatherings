import React, { useState } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../services/api';

interface UploadCardProps {
    onUploadStart: () => void;
    onUploadComplete: (videoId: string) => void;
    onUploadError: (error: string) => void;
    label?: string;
}

export default function UploadCard({ onUploadStart, onUploadComplete, onUploadError, label = "Upload CCTV Footage" }: UploadCardProps) {
    const [dragActive, setDragActive] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFile(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        try {
            setUploading(true);
            onUploadStart();
            const { video_id } = await api.uploadVideo(file);
            onUploadComplete(video_id);
        } catch (err: any) {
            onUploadError(err.message || 'Upload failed');
            setUploading(false);
        }
    };

    return (
        <div className="card">
            <h3 className="text-xl font-bold text-white mb-4">{label}</h3>

            {!file ? (
                <div
                    className={clsx(
                        "border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200",
                        dragActive ? "border-blue-500 bg-blue-500/5" : "border-slate-700 hover:border-slate-600"
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
                            <p className="text-slate-400 text-sm">MP4, AVI (Max 100MB)</p>
                        </div>
                        <label className="btn-secondary cursor-pointer">
                            <span>Browse Files</span>
                            <input type="file" className="hidden" accept="video/*" onChange={handleChange} />
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
                                <p className="text-white font-medium truncate max-w-[200px]">{file.name}</p>
                                <p className="text-xs text-slate-400">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                            </div>
                        </div>
                        {!uploading && (
                            <button
                                onClick={() => setFile(null)}
                                className="p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>

                    <button
                        onClick={handleUpload}
                        disabled={uploading}
                        className="btn-primary w-full"
                    >
                        {uploading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Uploading & Processing...
                            </>
                        ) : (
                            <>Start Analysis</>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
