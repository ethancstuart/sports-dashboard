import { Pool } from "@neondatabase/serverless";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export type Row = Record<string, unknown>;

export async function query<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  const { rows } = await pool.query(text, params);
  return rows as T[];
}

export async function queryOne<T = Row>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
