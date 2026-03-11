import {
  pgTable,
  serial,
  text,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

export const syncJobs = pgTable("sync_jobs", {
  id: serial("id").primaryKey(),
  jobName: text("job_name").notNull(), // pmx_sync, trademc_sync
  status: text("status").notNull(), // running, completed, failed
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  result: jsonb("result"),
  error: text("error"),
});
