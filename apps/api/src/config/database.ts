import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
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

export async function checkDatabaseConnection(): Promise<{ connected: boolean; error?: string }> {
  try {
    const client = postgres(env.DATABASE_URL, { max: 1, connect_timeout: 2 });
    await client`SELECT 1`;
    await client.end();
    return { connected: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { connected: false, error: errorMsg };
  }
}
