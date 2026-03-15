import { pgTable, integer, date, numeric, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const dailyMaxExposure = pgTable(
  "daily_max_exposure",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    date: date("date", { mode: "string" }).notNull(),
    maxExposureZar: numeric("max_exposure_zar", { precision: 18, scale: 2 }).notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [uniqueIndex("daily_max_exposure_date_idx").on(table.date)],
);
