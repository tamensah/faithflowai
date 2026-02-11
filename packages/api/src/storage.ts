import crypto from 'crypto';
import { Storage } from '@google-cloud/storage';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageProvider } from '@faithflow-ai/database';

export type SignedUploadResult = {
  provider: StorageProvider;
  bucket: string;
  key: string;
  uploadUrl: string;
  publicUrl: string;
};

const MAX_UPLOAD_BYTES = Number(process.env.UPLOAD_MAX_BYTES ?? 25 * 1024 * 1024);

const isTruthy = (value?: string | null) =>
  value === 'true' || value === '1' || value === 'yes';

const normalizePrivateKey = (value?: string | null) => {
  if (!value) return undefined;
  return value.includes('\\n') ? value.replace(/\\n/g, '\n') : value;
};

const sanitizeFilename = (filename: string) =>
  filename
    .trim()
    .replace(/[^a-zA-Z0-9_.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80) || 'upload';

const sanitizePurpose = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '') || 'general';

export const resolveStorageProvider = (override?: StorageProvider) => {
  if (override) return override;
  const envProvider = process.env.STORAGE_PROVIDER as StorageProvider | undefined;
  if (envProvider === StorageProvider.S3 || envProvider === StorageProvider.GCS) return envProvider;

  if (process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY) {
    return StorageProvider.S3;
  }
  if (process.env.GCS_BUCKET && (process.env.GCS_CLIENT_EMAIL || process.env.GCS_KEYFILE_PATH)) {
    return StorageProvider.GCS;
  }
  return StorageProvider.S3;
};

const buildPublicUrl = (provider: StorageProvider, bucket: string, key: string) => {
  if (provider === StorageProvider.S3) {
    const base = process.env.S3_PUBLIC_URL;
    if (base) return `${base.replace(/\/$/, '')}/${key}`;
    const region = process.env.S3_REGION || 'us-east-1';
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  const base = process.env.GCS_PUBLIC_URL;
  if (base) return `${base.replace(/\/$/, '')}/${key}`;
  return `https://storage.googleapis.com/${bucket}/${key}`;
};

const buildKey = (churchId: string, purpose: string, filename: string) => {
  const safeName = sanitizeFilename(filename);
  const date = new Date();
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const id = crypto.randomUUID();
  return `faithflow/${churchId}/${purpose}/${yyyy}/${mm}/${dd}/${id}-${safeName}`;
};

const getS3Client = () => {
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const region = process.env.S3_REGION || 'us-east-1';
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('S3 credentials are missing');
  }

  return new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: isTruthy(process.env.S3_FORCE_PATH_STYLE),
  });
};

const getGcsClient = () => {
  const projectId = process.env.GCS_PROJECT_ID;
  const keyFile = process.env.GCS_KEYFILE_PATH;
  const clientEmail = process.env.GCS_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.GCS_PRIVATE_KEY);

  if (keyFile) {
    return new Storage({ projectId, keyFilename: keyFile });
  }

  if (!clientEmail || !privateKey) {
    throw new Error('GCS credentials are missing');
  }

  return new Storage({
    projectId,
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
  });
};

export async function createSignedUpload(input: {
  churchId: string;
  filename: string;
  contentType?: string | null;
  size?: number | null;
  purpose?: string | null;
  provider?: StorageProvider;
}): Promise<SignedUploadResult> {
  if (input.size && input.size > MAX_UPLOAD_BYTES) {
    throw new Error('File too large');
  }

  const provider = resolveStorageProvider(input.provider);
  const purpose = sanitizePurpose(input.purpose ?? 'general');
  const key = buildKey(input.churchId, purpose, input.filename);

  if (provider === StorageProvider.S3) {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) {
      throw new Error('S3 bucket is missing');
    }

    const client = getS3Client();
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: input.contentType || 'application/octet-stream',
      CacheControl: 'max-age=31536000',
      ACL: isTruthy(process.env.S3_PUBLIC_READ) ? 'public-read' : undefined,
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 900 });
    const publicUrl = buildPublicUrl(StorageProvider.S3, bucket, key);

    return { provider, bucket, key, uploadUrl, publicUrl };
  }

  const bucket = process.env.GCS_BUCKET;
  if (!bucket) {
    throw new Error('GCS bucket is missing');
  }

  const storage = getGcsClient();
  const [uploadUrl] = await storage.bucket(bucket).file(key).getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + 15 * 60 * 1000,
    contentType: input.contentType || 'application/octet-stream',
  });

  const publicUrl = buildPublicUrl(StorageProvider.GCS, bucket, key);

  return { provider, bucket, key, uploadUrl, publicUrl };
}
