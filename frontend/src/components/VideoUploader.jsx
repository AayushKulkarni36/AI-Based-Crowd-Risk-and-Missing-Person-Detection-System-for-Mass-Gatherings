import { useState } from 'react';
import { Upload, X } from 'lucide-react';

export default function VideoUploader({ onFileSelect, file, onRemove }) {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.type === 'dragenter' || event.type === 'dragover') {
      setDragActive(true);
    } else if (event.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    if (event.dataTransfer?.files?.length) {
      onFileSelect(event.dataTransfer.files[0]);
    }
  };

  const handleChange = (event) => {
    if (event.target?.files?.length) {
      onFileSelect(event.target.files[0]);
    }
  };

  return (
    <div
      className={`relative glass-card p-8 transition-all duration-300 ${dragActive ? 'ring-4 ring-white/50' : ''}`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      {file ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-blue-500 rounded-2xl flex items-center justify-center">
              <Upload className="w-8 h-8 text-white" />
            </div>
            <div>
              <p className="text-white font-semibold">{file.name}</p>
              <p className="text-white/60 text-sm">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="w-10 h-10 bg-red-500/20 hover:bg-red-500/30 rounded-xl flex items-center justify-center transition-all"
          >
            <X className="w-5 h-5 text-red-400" />
          </button>
        </div>
      ) : (
        <div className="text-center">
          <Upload className="w-16 h-16 text-white/40 mx-auto mb-4" />
          <p className="text-xl font-semibold text-white mb-2">Drop your video here</p>
          <p className="text-white/60 mb-6">or click to browse</p>
          <input id="video-upload" type="file" accept="video/*" onChange={handleChange} className="hidden" />
          <label htmlFor="video-upload" className="btn-primary cursor-pointer inline-block">
            Choose Video
          </label>
        </div>
      )}
    </div>
  );
}
