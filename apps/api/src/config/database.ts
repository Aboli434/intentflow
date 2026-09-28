import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import path from 'node:path';
import { env } from './env.js';
import * as schema from '../db/schema.js';

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let queryClient: ReturnType<typeof postgres> | null = null;

export function getDb() {
  if (!dbInstance) {
    queryClient = postgres(env.DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 5,
    });
    dbInstance = drizzle(queryClient, { schema });
  }
  return dbInstance;
}

export async function checkDatabaseConnection(): Promise<{ connected: boolean }> {
  try {
    const db = getDb();
    await db.execute(sql`SELECT 1`);
    return { connected: true };
  } catch {
    return { connected: false };
  }
}

export async function runDatabaseMigrations(): Promise<void> {
  try {
    const db = getDb();
    const migrationsFolder = path.resolve(process.cwd(), 'src/db/migrations');
    await migrate(db, { migrationsFolder });
    console.log('[Database] Drizzle SQL migrations applied successfully.');
  } catch (err: any) {
    console.warn('[Database] Drizzle migration note:', err.message || err);
    await ensurePhase16Schema();
  }
}

export async function ensurePhase16Schema(): Promise<void> {
  try {
    const client = postgres(env.DATABASE_URL, { max: 1 });
    await client.unsafe(`
      ALTER TABLE organization_invitations ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP;
      ALTER TABLE organization_invitations ADD COLUMN IF NOT EXISTS delivery_status TEXT;
      ALTER TABLE organization_invitations ADD COLUMN IF NOT EXISTS last_delivery_attempt TIMESTAMP;
      ALTER TABLE organization_invitations ADD COLUMN IF NOT EXISTS failure_reason TEXT;
      ALTER TABLE attachments ADD COLUMN IF NOT EXISTS project_id TEXT;
      ALTER TABLE attachments ADD COLUMN IF NOT EXISTS uploaded_by TEXT;
      ALTER TABLE attachments ADD COLUMN IF NOT EXISTS related_entity_type TEXT;
      ALTER TABLE attachments ADD COLUMN IF NOT EXISTS related_entity_id TEXT;
    `);
    await client.end();
  } catch (err) {
    console.error('ensurePhase16Schema warning:', err);
  }
}
