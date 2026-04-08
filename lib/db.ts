import { createClient } from "@libsql/client";

export const db = createClient({
  url: process.env.TURSO_URL || "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export type Row = Record<string, unknown>;

export async function query<T = Row>(sql: string, args: unknown[] = []): Promise<T[]> {
  const result = await db.execute(sql, args as any[]); // eslint-disable-line @typescript-eslint/no-explicit-any
  return result.rows as unknown as T[];
}

export async function queryOne<T = Row>(sql: string, args: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(sql, args);
  return rows[0] ?? null;
}
