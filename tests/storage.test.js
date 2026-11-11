import assert from 'node:assert/strict';
import test from 'node:test';
import { detectFileType, resolvePrivateReference, resolveStoredReference, validateUploadFile } from '../src/storage.js';

const signatures = {
  jpeg: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  gif: Buffer.from('GIF89a'),
  webp: Buffer.from('RIFF0000WEBP'),
  pdf: Buffer.from('%PDF-1.7'),
};

test('detects supported uploaded file formats from their contents', () => {
  assert.equal(detectFileType(signatures.jpeg).mimeType, 'image/jpeg');
  assert.equal(detectFileType(signatures.png).mimeType, 'image/png');
  assert.equal(detectFileType(signatures.gif).mimeType, 'image/gif');
  assert.equal(detectFileType(signatures.webp).mimeType, 'image/webp');
  assert.equal(detectFileType(signatures.pdf).mimeType, 'application/pdf');
  assert.equal(detectFileType(Buffer.from('not an image')), null);
});

test('accepts supported images and documents only in appropriate fields', () => {
  assert.equal(validateUploadFile({ buffer: signatures.png, size: signatures.png.length }, 'photo').extension, 'png');
  assert.equal(validateUploadFile({ buffer: signatures.png, size: signatures.png.length }, 'cover_image').extension, 'png');
  assert.equal(validateUploadFile({ buffer: signatures.pdf, size: signatures.pdf.length }, 'certificate').extension, 'pdf');
  assert.throws(
    () => validateUploadFile({ buffer: signatures.pdf, size: signatures.pdf.length }, 'image'),
    /valid JPEG, PNG, GIF, or WebP image/,
  );
  assert.throws(
    () => validateUploadFile({ buffer: signatures.pdf, size: signatures.pdf.length }, 'cover_image'),
    /valid JPEG, PNG, GIF, or WebP image/,
  );
  assert.throws(
    () => validateUploadFile({ buffer: signatures.pdf, size: signatures.pdf.length }, 'photo'),
    /valid JPEG, PNG, GIF, or WebP image/,
  );
  assert.throws(
    () => validateUploadFile({ buffer: signatures.gif, size: signatures.gif.length }, 'certificate'),
    /JPEG, PNG, or WebP image, or a PDF/,
  );
  assert.throws(
    () => validateUploadFile({ buffer: Buffer.from('bad'), size: 3 }, 'photo'),
    /valid JPEG, PNG, GIF, or WebP image/,
  );
});

test('enforces image and document upload size limits', () => {
  assert.throws(
    () => validateUploadFile({ buffer: signatures.png, size: 1024 * 1024 + 1 }, 'photo'),
    /Profile photos must not exceed 1 MB/,
  );
  assert.throws(
    () => validateUploadFile({ buffer: signatures.png, size: 5 * 1024 * 1024 + 1 }, 'image'),
    /Uploaded files must not exceed 5 MB/,
  );
});

test('preserves existing local and public URLs', async () => {
  const legacyReference = '/media/legacy-image';
  const publicReference = 'https://project.supabase.co/storage/v1/object/public/athlenet-media/image.png';
  assert.equal(await resolveStoredReference(legacyReference), legacyReference);
  assert.equal(await resolveStoredReference(publicReference), publicReference);
});

test('does not resolve private document URLs for anyone except the owner', async () => {
  const privateReference = 'supabase-storage://athlenet-documents/42/certificate/document.pdf';
  assert.equal(await resolvePrivateReference(privateReference, 42, 43), '');
  const configNames = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_MEDIA_BUCKET', 'SUPABASE_DOCUMENTS_BUCKET'];
  const previous = Object.fromEntries(configNames.map(name => [name, process.env[name]]));
  try {
    for (const name of configNames) delete process.env[name];
    await assert.rejects(resolvePrivateReference(privateReference, 42, '42'), error => error.status === 503);
  } finally {
    for (const name of configNames) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});
