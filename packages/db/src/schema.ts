import type { InferSelectModel } from 'drizzle-orm';
import {
  varchar,
  timestamp,
  json,
  jsonb,
  uuid,
  text,
  boolean,
  pgSchema,
  primaryKey,
} from 'drizzle-orm/pg-core';
import type { LanguageModelV3Usage } from '@ai-sdk/provider';

const schemaName = 'ai_chatbot';
const customSchema = pgSchema(schemaName);

// Helper function to create table with proper schema handling
const createTable = customSchema.table;

// ─────────────────────────────────────────────
// Existing Chat tables
// ─────────────────────────────────────────────

export const chat = createTable('Chat', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  createdAt: timestamp('createdAt').notNull(),
  title: text('title').notNull(),
  userId: text('userId').notNull(),
  visibility: varchar('visibility', { enum: ['public', 'private'] })
    .notNull()
    .default('private'),
  lastContext: jsonb('lastContext').$type<LanguageModelV3Usage | null>(),
});

export type Chat = InferSelectModel<typeof chat>;

export const message = createTable('Message', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  chatId: uuid('chatId')
    .notNull()
    .references(() => chat.id),
  role: varchar('role').notNull(),
  parts: json('parts').notNull(),
  attachments: json('attachments').notNull(),
  createdAt: timestamp('createdAt').notNull(),
  traceId: text('traceId'),
});

export type DBMessage = InferSelectModel<typeof message>;

export const vote = createTable(
  'Vote',
  {
    chatId: uuid('chatId').notNull().references(() => chat.id),
    messageId: uuid('messageId').notNull().references(() => message.id),
    isUpvoted: boolean('isUpvoted').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.chatId, table.messageId] }),
  }),
);

export type Vote = InferSelectModel<typeof vote>;

// ─────────────────────────────────────────────
// Authentication
// ─────────────────────────────────────────────

export const user = createTable('User', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('passwordHash').notNull(),
  role: text('role').notNull().default('Recruiter'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export type User = InferSelectModel<typeof user>;

// ─────────────────────────────────────────────
// Password Reset
// ─────────────────────────────────────────────

export const passwordResetToken = createTable('PasswordResetToken', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id),
  tokenHash: text('tokenHash').notNull().unique(),
  expiresAt: timestamp('expiresAt').notNull(),
  usedAt: timestamp('usedAt'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

export type PasswordResetToken = InferSelectModel<
  typeof passwordResetToken
>;