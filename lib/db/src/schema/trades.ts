import { usersTable } from "./auth";
import { pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tradesTable = pgTable("trades", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => usersTable.id, {
    onDelete: "cascade",
  }),
  symbol: varchar("symbol", { length: 32 }).notNull(),
  asset: varchar("asset", { length: 96 }).notNull(),
  side: varchar("side", { length: 4 }).notNull(),
  lotSize: text("lot_size").notNull(),
  entryAt: timestamp("entry_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
  strategy: varchar("strategy", { length: 96 }).notNull(),
  regime: varchar("regime", { length: 96 }).notNull(),
  pnl: text("pnl").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
});

export const insertTradeSchema = createInsertSchema(tradesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof tradesTable.$inferSelect;
