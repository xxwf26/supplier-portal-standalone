import { mysqlTable, varchar, int, boolean, timestamp } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

export const filterConfig = mysqlTable('filter_config', {
  id: varchar('id', { length: 36 }).notNull().primaryKey(),
  category: varchar('category', { length: 50 }).notNull(),
  label: varchar('label', { length: 100 }).notNull(),
  value: varchar('value', { length: 100 }).notNull(),
  color: varchar('color', { length: 30 }),
  sortOrder: int('sort_order').default(0),
  enabled: boolean('enabled').default(true),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
});