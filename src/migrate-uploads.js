import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, query } from './db.js';
import { detectFileType, removeStoredAssets, uploadAsset, UploadError, validateUploadFile } from './storage.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uploadDir = path.join(root, 'uploads');
const apply = process.argv.includes('--apply');
const targets = [
  { table: 'profiles', column: 'photo', fieldName: 'photo', ownerColumn: 'user_id' },
  { table: 'posts', column: 'image', fieldName: 'image', ownerColumn: 'author_id' },
  { table: 'coach_profiles', column: 'certificate', fieldName: 'certificate', ownerColumn: 'profile_id' },
  { table: 'achievements', column: 'proof', fieldName: 'achievement_proof', ownerColumn: 'player_id' },
];

function localFilename(reference) {
  if (typeof reference !== 'string' || !reference.startsWith('/media/')) return null;
  const filename = path.basename(reference.slice('/media/'.length));
  if (!filename || filename === '.' || filename === '..') return null;
  return filename;
}

async function main() {
  const summary = { mode: apply ? 'apply' : 'dry-run', eligible: 0, migrated: 0, missing: 0, invalid: 0 };
  for (const target of targets) {
    const rows = await query(
      `SELECT id, ${target.ownerColumn} AS owner_id, ${target.column} AS reference FROM ${target.table} WHERE ${target.column} LIKE '/media/%'`,
    );
    for (const row of rows.rows) {
      const filename = localFilename(row.reference);
      if (!filename) {
        summary.invalid += 1;
        continue;
      }
      const filePath = path.resolve(uploadDir, filename);
      if (path.dirname(filePath) !== uploadDir) {
        summary.invalid += 1;
        continue;
      }
      let buffer;
      try {
        buffer = await fs.readFile(filePath);
      } catch (error) {
        if (error.code === 'ENOENT') {
          summary.missing += 1;
          continue;
        }
        throw error;
      }
      const detected = detectFileType(buffer);
      if (!detected) {
        summary.invalid += 1;
        continue;
      }
      const file = { buffer, size: buffer.length, mimetype: detected.mimeType };
      try {
        validateUploadFile(file, target.fieldName);
      } catch (error) {
        if (!(error instanceof UploadError)) throw error;
        summary.invalid += 1;
        continue;
      }
      summary.eligible += 1;
      if (!apply) continue;

      const asset = await uploadAsset(file, {
        fieldName: target.fieldName,
        ownerId: row.owner_id,
      });
      try {
        const updated = await query(
          `UPDATE ${target.table} SET ${target.column}=$1 WHERE id=$2 AND ${target.column}=$3`,
          [asset.reference, row.id, row.reference],
        );
        if (updated.rowCount !== 1) {
          await removeStoredAssets([{ bucket: asset.bucket, objectPath: asset.objectPath }]);
          summary.invalid += 1;
          continue;
        }
        summary.migrated += 1;
      } catch (error) {
        try {
          await removeStoredAssets([{ bucket: asset.bucket, objectPath: asset.objectPath }]);
        } catch (cleanupError) {
          console.error('Failed to remove a migration object after a database update error.', cleanupError);
        }
        throw error;
      }
    }
  }
  console.log(JSON.stringify(summary, null, 2));
  if (!apply) {
    console.log('Dry run only. Back up the database and uploads directory before running with --apply.');
  }
}

try {
  await main();
} finally {
  await pool.end();
}
