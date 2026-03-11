import { createDb, type Database } from "@foundation/db";

let _db: Database | null = null;

export function getDb(): Database {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL environment variable is required. See .env.example for setup."
      );
    }
    _db = createDb(url);
  }
  return _db;
}

// Proxy that lazily initializes the database connection on first use.
// This prevents build-time errors when DATABASE_URL is not set.
export const db: Database = new Proxy({} as Database, {
  get(_target, prop) {
    return (getDb() as any)[prop];
  },
});
