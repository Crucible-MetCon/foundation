const path = require("path");
const postgres = require(path.resolve(__dirname, "../packages/db/node_modules/postgres"));

const sql = postgres(process.env.DATABASE_URL);

async function main() {
  await sql.unsafe(`
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
  `);
  console.log("Table dev_tasks created");

  await sql.unsafe("CREATE INDEX IF NOT EXISTS dev_tasks_status_idx ON dev_tasks(status)");
  await sql.unsafe("CREATE INDEX IF NOT EXISTS dev_tasks_type_idx ON dev_tasks(type)");
  await sql.unsafe("CREATE INDEX IF NOT EXISTS dev_tasks_created_by_idx ON dev_tasks(created_by)");
  console.log("Indexes created");

  const result = await sql.unsafe("SELECT count(*)::int as count FROM dev_tasks");
  console.log("Verified - rows:", result[0].count);

  await sql.end();
}

main().catch(e => {
  console.error("Error:", e.message);
  process.exit(1);
});
