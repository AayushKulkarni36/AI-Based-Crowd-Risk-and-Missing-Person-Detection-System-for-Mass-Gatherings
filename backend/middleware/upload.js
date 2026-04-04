import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================================
// VIDEO UPLOAD
// ============================================================================
const videoUploadDir = path.join(__dirname, '../../data/uploads/videos');
if (!fs.existsSync(videoUploadDir)) {
  fs.mkdirSync(videoUploadDir, { recursive: true });
}

const videoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, videoUploadDir),
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
    cb(null, uniqueName);
  }
});

const allowedVideoMimeTypes = new Set([
  'video/mp4',
  'video/avi',
  'video/x-msvideo',
  'video/quicktime',
  'video/mov',
  'video/mpeg',
  'video/x-ms-wmv',
  'video/webm',
  'application/octet-stream' // Some browsers send this for .avi
]);

const allowedVideoExtensions = new Set(['.mp4', '.avi', '.mov', '.mpeg', '.mpg', '.wmv', '.webm']);

const videoFileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedVideoMimeTypes.has(file.mimetype) || allowedVideoExtensions.has(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: MP4, AVI, MOV, MPEG, WMV, WebM`));
  }
};

export const videoUpload = multer({
  storage: videoStorage,
  fileFilter: videoFileFilter,
  limits: { fileSize: 1000 * 1024 * 1024 } // 1 GB
});

// ============================================================================
// IMAGE UPLOAD (for missing person photos)
// ============================================================================
const photoUploadDir = path.join(__dirname, '../../data/uploads/photos');
if (!fs.existsSync(photoUploadDir)) {
  fs.mkdirSync(photoUploadDir, { recursive: true });
}

const photoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, photoUploadDir),
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
    cb(null, uniqueName);
  }
});

const allowedImageMimeTypes = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif'
]);

const imageFileFilter = (_req, file, cb) => {
  if (allowedImageMimeTypes.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid image type: ${file.mimetype}. Allowed: JPEG, PNG, WebP`));
  }
};

export const imageUpload = multer({
  storage: photoStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
});

// Default export for backward compatibility (video upload)
export default videoUpload;
