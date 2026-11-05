import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { Pool } = pg;
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
});
export async function query(text, params=[]) { return pool.query(text, params); }
export async function initDb() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const schema = fs.readFileSync(path.join(here, '..', 'schema.sql'), 'utf8');
  await pool.query(schema);
}
