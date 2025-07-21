import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Database connection
const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client);

// Database schema
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  appleId: text('apple_id').unique().notNull(),
  email: text('email'),
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const routers = pgTable('routers', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).unique().notNull(),
  ipAddress: text('ip_address').notNull(),
  username: text('username').default('admin').notNull(),
  password: text('password').default('admin').notNull(),
  model: text('model'),
  brand: text('brand'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
