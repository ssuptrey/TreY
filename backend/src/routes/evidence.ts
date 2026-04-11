import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { EvidenceController } from '../controllers/evidenceController';
import { authenticate } from '../middlewares/auth';
import { AuthenticatedRequest } from '../types/requests';

const router = Router();

const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req: AuthenticatedRequest, _file, cb) => {
    const orgDir = path.join(uploadDir, req.user!.organization_id);
    if (!fs.existsSync(orgDir)) {
      fs.mkdirSync(orgDir, { recursive: true });
    }
    cb(null, orgDir);
  },
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}-${safeName}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

const evidenceController = new EvidenceController({
  evidenceService: {} as any,
  evidenceRepository: {} as any,
  auditRepository: {} as any
});

router.post('/:obligationId', authenticate, upload.single('file'), evidenceController.upload);
router.get('/obligation/:obligationId', authenticate, evidenceController.listByObligation);
router.get('/:id/download', authenticate, evidenceController.download);

export default router;
