import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const IMAGE_TYPES = new Map([
  ['image/jpeg', { extension: 'jpg', matches: buffer => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff }],
  ['image/png', { extension: 'png', matches: buffer => buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) }],
  ['image/gif', { extension: 'gif', matches: buffer => ['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6)) }],
  ['image/webp', { extension: 'webp', matches: buffer => buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP' }],
]);
const DOCUMENT_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PDF_TYPE = {
  mimeType: 'application/pdf',
  extension: 'pdf',
  matches: buffer => buffer.subarray(0, 5).toString('ascii') === '%PDF-',
};
const PRIVATE_REFERENCE_PREFIX = 'supabase-storage://';
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const SIGNED_URL_SECONDS = 60 * 60;

let client;

export class UploadError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'UploadError';
    this.status = status;
  }
}

function getConfig() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_MEDIA_BUCKET, SUPABASE_DOCUMENTS_BUCKET } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_MEDIA_BUCKET || !SUPABASE_DOCUMENTS_BUCKET) {
    throw new UploadError('Image storage is not configured on the server.', 503);
  }
  return { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_MEDIA_BUCKET, SUPABASE_DOCUMENTS_BUCKET };
}

function getClient(config) {
  if (!client) {
    client = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}

export function detectFileType(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  for (const [mimeType, type] of IMAGE_TYPES) {
    if (type.matches(buffer)) return { mimeType, extension: type.extension };
  }
  if (PDF_TYPE.matches(buffer)) return { mimeType: PDF_TYPE.mimeType, extension: PDF_TYPE.extension };
  return null;
}

export function validateUploadFile(file, fieldName) {
  if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw new UploadError('The uploaded file is empty or invalid.');
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new UploadError('Uploaded files must not exceed 5 MB.');
  }
  if (fieldName === 'photo' && file.size > 1024 * 1024) {
    throw new UploadError('Profile photos must not exceed 1 MB.');
  }
  const detected = detectFileType(file.buffer);
  const imageField = ['photo', 'cover_image', 'image'].includes(fieldName);
  if (!detected || (imageField && !IMAGE_TYPES.has(detected.mimeType))) {
    throw new UploadError('Upload a valid JPEG, PNG, GIF, or WebP image; PDF files are only accepted for documents.');
  }
  if (['certificate', 'achievement_proof'].includes(fieldName)
    && !DOCUMENT_IMAGE_TYPES.has(detected.mimeType) && detected.mimeType !== PDF_TYPE.mimeType) {
    throw new UploadError('Upload a JPEG, PNG, or WebP image, or a PDF document.');
  }
  if (!['photo', 'cover_image', 'image', 'certificate', 'achievement_proof'].includes(fieldName)) {
    throw new UploadError('This upload field is not supported.');
  }
  return detected;
}

export async function uploadAsset(file, { fieldName, ownerId }) {
  const detected = validateUploadFile(file, fieldName);
  const config = getConfig();
  const isDocument = fieldName === 'certificate' || fieldName === 'achievement_proof';
  const bucket = isDocument ? config.SUPABASE_DOCUMENTS_BUCKET : config.SUPABASE_MEDIA_BUCKET;
  const owner = String(ownerId || 'unassigned').replace(/[^a-zA-Z0-9_-]/g, '_');
  const objectPath = `${owner}/${fieldName}/${randomUUID()}.${detected.extension}`;
  const { error } = await getClient(config).storage.from(bucket).upload(objectPath, file.buffer, {
    contentType: detected.mimeType,
    upsert: false,
  });
  if (error) {
    throw new UploadError('Unable to save the uploaded file. Please try again.', 502);
  }

  if (isDocument) {
    return { reference: `${PRIVATE_REFERENCE_PREFIX}${bucket}/${objectPath}`, bucket, objectPath };
  }
  const { data } = getClient(config).storage.from(bucket).getPublicUrl(objectPath);
  if (!data?.publicUrl) {
    await removeStoredAssets([{ bucket, objectPath }]);
    throw new UploadError('Unable to create a permanent URL for the uploaded file.', 502);
  }
  return { reference: data.publicUrl, bucket, objectPath };
}

export async function uploadAssets(files, ownerId) {
  const uploaded = [];
  const references = {};
  try {
    for (const [fieldName, file] of Object.entries(files)) {
      if (!file) continue;
      const asset = await uploadAsset(file, { fieldName, ownerId });
      uploaded.push({ bucket: asset.bucket, objectPath: asset.objectPath });
      references[fieldName] = asset.reference;
    }
  } catch (error) {
    try {
      await removeStoredAssets(uploaded);
    } catch (cleanupError) {
      console.error('Failed to clean up an incomplete storage upload.', cleanupError);
    }
    throw error;
  }
  return { references, uploaded };
}

export async function removeStoredAssets(assets) {
  if (!assets.length) return;
  const config = getConfig();
  const storage = getClient(config).storage;
  const buckets = new Map();
  for (const asset of assets) {
    const paths = buckets.get(asset.bucket) || [];
    paths.push(asset.objectPath);
    buckets.set(asset.bucket, paths);
  }
  for (const [bucket, paths] of buckets) {
    const { error } = await storage.from(bucket).remove(paths);
    if (error) throw new UploadError('Uploaded files could not be rolled back from storage.', 502);
  }
}

export function resolveMediaReference(reference) {
  if (typeof reference !== 'string' || !reference.startsWith(PRIVATE_REFERENCE_PREFIX)) return reference;
  const remainder = reference.slice(PRIVATE_REFERENCE_PREFIX.length);
  const separator = remainder.indexOf('/');
  if (separator <= 0 || separator === remainder.length - 1) return '';
  const bucket = remainder.slice(0, separator);
  const objectPath = remainder.slice(separator + 1);
  const config = getConfig();
  if (bucket !== config.SUPABASE_MEDIA_BUCKET) return '';
  const { data } = getClient(config).storage.from(bucket).getPublicUrl(objectPath);
  return data?.publicUrl || '';
}

export async function resolveStoredReference(reference) {
  if (typeof reference !== 'string' || !reference.startsWith(PRIVATE_REFERENCE_PREFIX)) return reference;
  const remainder = reference.slice(PRIVATE_REFERENCE_PREFIX.length);
  const separator = remainder.indexOf('/');
  if (separator <= 0 || separator === remainder.length - 1) return '';
  const bucket = remainder.slice(0, separator);
  const objectPath = remainder.slice(separator + 1);
  const config = getConfig();
  if (bucket !== config.SUPABASE_DOCUMENTS_BUCKET) return '';
  const { data, error } = await getClient(config).storage.from(bucket).createSignedUrl(objectPath, SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) throw new UploadError('Unable to retrieve a stored document.', 502);
  return data.signedUrl;
}

export async function resolvePrivateReference(reference, ownerId, viewerId) {
  if (ownerId == null || viewerId == null || String(ownerId) !== String(viewerId)) return '';
  return resolveStoredReference(reference);
}
