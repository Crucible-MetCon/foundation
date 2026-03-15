import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL);

try {
  await sql`
    CREATE TABLE IF NOT EXISTS dev_tasks (
      id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL DEFAULT 'enhancement',
      status TEXT NOT NULL DEFAULT 'open',
      priority TEXT NOT NULL DEFAULT 'medium',
      created_by INTEGER NOT NULL REFERENCES users(id),
      assigned_to INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )
  `;
  console.log("Table dev_tasks created");

  await sql`CREATE INDEX IF NOT EXISTS dev_tasks_status_idx ON dev_tasks(status)`;
  await sql`CREATE INDEX IF NOT EXISTS dev_tasks_type_idx ON dev_tasks(type)`;
  await sql`CREATE INDEX IF NOT EXISTS dev_tasks_created_by_idx ON dev_tasks(created_by)`;
  console.log("Indexes created");

  const result = await sql`SELECT count(*)::int as count FROM dev_tasks`;
  console.log("Verified - rows:", result[0].count);
} catch (e) {
  console.error("Error:", e.message);
  process.exit(1);
} finally {
  await sql.end();
}
