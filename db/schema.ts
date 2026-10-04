import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const accounts = sqliteTable('accounts', {id:text('id').primaryKey(),email:text('email').notNull(),data:text('data').notNull(),created:integer('created').notNull()});
export const records = sqliteTable('records', {id:text('id').primaryKey(),kind:text('kind').notNull(),owner:text('owner').notNull(),recipient:text('recipient'),data:text('data').notNull(),created:integer('created').notNull()}, t=>[index('records_kind_owner').on(t.kind,t.owner),index('records_kind_recipient').on(t.kind,t.recipient)]);
