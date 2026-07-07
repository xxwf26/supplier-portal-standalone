import { mysqlTable, varchar, text, timestamp, index, unique } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

/** 候选清单（寻源用的分组，如「XX项目头像候选」）。全库共享，无用户隔离。 */
export const shortlists = mysqlTable('shortlists', {
  id: varchar('id', { length: 36 }).notNull().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: varchar('description', { length: 500 }),
  createdBy: varchar('created_by', { length: 255 }),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`).onUpdateNow(),
});

/** 清单成员：某画师在某清单中的接洽状态与备注。 */
export const shortlistItems = mysqlTable('shortlist_items', {
  id: varchar('id', { length: 36 }).notNull().primaryKey(),
  shortlistId: varchar('shortlist_id', { length: 36 }).notNull(),
  supplierId: varchar('supplier_id', { length: 36 }).notNull(),
  // 接洽状态：pending 待联系 / contacted 已联系 / quoted 已报价 / cooperated 已合作 / dropped 已放弃
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  note: text('note'),
  addedBy: varchar('added_by', { length: 255 }),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`).onUpdateNow(),
}, (t) => ({
  shortlistIdx: index('idx_shortlist_items_list').on(t.shortlistId),
  supplierIdx: index('idx_shortlist_items_supplier').on(t.supplierId),
  // 同一清单里同一画师只出现一次
  uniqListSupplier: unique('uniq_shortlist_supplier').on(t.shortlistId, t.supplierId),
}));
