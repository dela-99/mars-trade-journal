import { usersTable } from "./auth";
import {
  date,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const journalNotesTable = pgTable("journal_notes", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => usersTable.id, {
    onDelete: "cascade",
  }),
  date: date("date").notNull(),
  timeZone: varchar("time_zone", { length: 100 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body").notNull(),
  linkMode: varchar("link_mode", { length: 8 })
    .$type<"date" | "selected">()
    .notNull(),
  // Retain selected IDs when a trade is deleted so notes never silently relink.
  selectedTradeIds: jsonb("selected_trade_ids").$type<number[]>().notNull(),
  attachments: jsonb("attachments")
    .$type<
      Array<{ id: string; name: string; caption: string; dataUrl: string }>
    >()
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
