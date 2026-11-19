import { integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/**
 * One row per online room. The whole game state lives in `state` (JSON) and
 * `version` is bumped on every write for optimistic concurrency.
 */
export const rooms = pgTable('rooms', {
  code: text().primaryKey(),
  state: jsonb().notNull(),
  version: integer().notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
