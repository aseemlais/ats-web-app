// IMPORTANT: Load environment variables FIRST.
import { config } from 'dotenv';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, '..');
const envPath = join(projectRoot, '.env');

config({
  path: envPath,
});

import {
  isDatabaseAvailable,
  getSchemaName,
  getConnectionUrl,
} from '@chat-template/db';

async function main() {
  const { default: postgres } = await import('postgres');

  console.log('🔄 Running database migration...');

  if (!isDatabaseAvailable()) {
    console.warn('⚠️ Database configuration not found!');
    console.warn(
      'ℹ️ Please set PGDATABASE/PGHOST/PGUSER or POSTGRES_URL environment variables.',
    );
    console.warn('💡 Skipping migrations in ephemeral mode...');
    process.exit(0);
  }

  console.log(
    '📊 Database configuration detected, running migrations...',
  );

  const schemaName = getSchemaName();

  console.log(`🗃️ Using database schema: ${schemaName}`);

  const connectionUrl = await getConnectionUrl();

  const db = postgres(connectionUrl, {
    max: 1,
  });

  try {
    // ---------------------------------------------------------
    // 1. Ensure application schema exists
    // ---------------------------------------------------------
    console.log(
      `📁 Creating schema '${schemaName}' if it doesn't exist...`,
    );

    await db`
      CREATE SCHEMA IF NOT EXISTS ${db(schemaName)}
    `;

    console.log(
      `✅ Schema '${schemaName}' ensured to exist`,
    );

    // ---------------------------------------------------------
    // 2. Find migration files
    // ---------------------------------------------------------
    const migrationsFolder = join(
      projectRoot,
      'packages',
      'db',
      'migrations',
    );

    console.log(
      '📂 Migrations folder:',
      migrationsFolder,
    );

    // ---------------------------------------------------------
    // 3. Read migration journal
    // ---------------------------------------------------------
    const journalPath = join(
      migrationsFolder,
      'meta',
      '_journal.json',
    );

    console.log(
      '📖 Reading migration journal:',
      journalPath,
    );

    const journalText = await readFile(
      journalPath,
      'utf8',
    );

    const journal = JSON.parse(journalText);

    const entries = Array.isArray(journal.entries)
      ? journal.entries
      : [];

    console.log(
      `📋 Found ${entries.length} migration(s) in journal`,
    );

    // ---------------------------------------------------------
    // 4. Create our own migration tracking table
    //    INSIDE ai_chatbot instead of drizzle schema
    // ---------------------------------------------------------
    const migrationTable = `${schemaName}.__drizzle_migrations`;

    console.log(
      `📝 Ensuring migration table exists: ${migrationTable}`,
    );

    await db`
      CREATE TABLE IF NOT EXISTS ${db(schemaName)}.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `;

    console.log(
      '✅ Migration tracking table ready',
    );

    // ---------------------------------------------------------
    // 5. Read already-applied migrations
    // ---------------------------------------------------------
    const appliedMigrations =
      await db.unsafe(
        `
          SELECT hash, created_at
          FROM "${schemaName}"."__drizzle_migrations"
          ORDER BY id
        `,
      );

    const appliedHashes = new Set(
      appliedMigrations.map(
        (row: { hash: string }) => row.hash,
      ),
    );

    console.log(
      `📊 Already applied migrations: ${appliedHashes.size}`,
    );

    // ---------------------------------------------------------
    // 6. Apply pending migrations
    // ---------------------------------------------------------
    for (const entry of entries) {
      const tag = entry.tag;

      if (!tag) {
        console.warn(
          '⚠️ Migration entry has no tag. Skipping.',
        );
        continue;
      }

      const migrationFile = join(
        migrationsFolder,
        `${tag}.sql`,
      );

      const migrationSql = await readFile(
        migrationFile,
        'utf8',
      );

      // Drizzle normally calculates the hash from the
      // migration SQL. For our custom tracking table,
      // use a SHA-256 hash.
      const { createHash } = await import(
        'node:crypto'
      );

      const hash = createHash('sha256')
        .update(migrationSql)
        .digest('hex');

      if (appliedHashes.has(hash)) {
        console.log(
          `⏭️ Migration ${tag} already applied`,
        );
        continue;
      }

      console.log(
        `🚀 Applying migration: ${tag}`,
      );

      // Run the migration SQL.
      await db.begin(async (transaction) => {
        await transaction.unsafe(
          migrationSql,
        );

        await transaction`
          INSERT INTO ${transaction(schemaName)}.__drizzle_migrations
            (hash, created_at)
          VALUES
            (
              ${hash},
              ${Date.now()}
            )
        `;
      });

      console.log(
        `✅ Migration ${tag} applied successfully`,
      );
    }

    console.log(
      '✅ All database migrations completed successfully',
    );
  } catch (error) {
    console.error(
      '❌ Database migration failed:',
      error,
    );

    const errorMessage =
      error instanceof Error
        ? error.message
        : String(error);

    console.error(
      '❌ Migration error:',
      errorMessage,
    );

    process.exit(1);
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  const errorMessage =
    error instanceof Error
      ? error.message
      : String(error);

  console.error(
    '❌ Migration script failed:',
    errorMessage,
  );

  process.exit(1);
});