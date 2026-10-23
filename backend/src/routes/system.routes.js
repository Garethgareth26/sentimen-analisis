import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { systemController } from '../controllers/system.controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.join(__dirname, '..', '..');

const INPUT_DIR = path.join(BACKEND_ROOT, 'input');
const MODEL_DIR = path.join(BACKEND_ROOT, 'models');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, INPUT_DIR),
  filename: (_req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

const modelStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, MODEL_DIR),
  filename: (_req, file, cb) => cb(null, file.originalname)
});
const uploadModel = multer({
  storage: modelStorage,
  fileFilter: (_req, file, cb) => {
    if (!/\.(pt|onnx)$/i.test(file.originalname)) return cb(new Error('Model harus .pt atau .onnx'));
    cb(null, true);
  }
});

const router = Router();

router.get('/health', systemController.health);
router.get('/sidecar-status', systemController.sidecarStatus);
router.get('/images', systemController.getImages);
router.post('/upload', upload.array('images'), systemController.uploadImages);
router.get('/models', systemController.getModels);
router.post('/upload-model', uploadModel.single('model'), systemController.uploadModel);
router.get('/settings', systemController.getSettings);
router.post('/settings', systemController.updateSettings);
router.get('/logs', systemController.getLogs);

export default router;
