import {
  pgTable,
  text,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const devTasks = pgTable(
  "dev_tasks",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    title: text("title").notNull(),
    description: text("description"),
    type: text("type").notNull().default("enhancement"), // bug, enhancement
    status: text("status").notNull().default("open"), // open, in_progress, completed
    priority: text("priority").notNull().default("medium"), // low, medium, high, critical
    createdBy: integer("created_by")
      .notNull()
      .references(() => users.id),
    assignedTo: integer("assigned_to").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("dev_tasks_status_idx").on(table.status),
    index("dev_tasks_type_idx").on(table.type),
    index("dev_tasks_created_by_idx").on(table.createdBy),
  ],
);
