import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { Request, Response, NextFunction } from 'express';

const uploadsDir = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
  }
};

export const uploadPhoto = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export async function processPhoto(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.file) { next(); return; }

  const filename = `photo-${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
  const outputPath = path.join(uploadsDir, filename);

  await sharp(req.file.buffer)
    .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(outputPath);

  req.file.filename = filename;
  req.file.path = outputPath;

  next();
}
