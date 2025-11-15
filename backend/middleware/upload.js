import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '../../data/uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
    cb(null, uniqueName);
  }
});

const allowedMimeTypes = new Set([
  'video/mp4',
  'video/avi',
  'video/quicktime',
  'video/x-msvideo',
  'video/mpeg'
]);

const fileFilter = (_req, file, cb) => {
  if (allowedMimeTypes.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only MP4, AVI, MOV, and MPEG formats allowed'));
  }
};

export default multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }
});
