import postgres from "postgres";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Read the database URL from environment variables
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL environment variable is not set");
  process.exit(1);
}

// Connect to the database
const sql = postgres(databaseUrl);

// Run migrations
async function main() {
  console.log("Running migrations...");

  try {
    // Create tables directly if they don't exist
    await sql`
      CREATE TABLE IF NOT EXISTS "tickets" (
        "id" text PRIMARY KEY NOT NULL,
        "order_number" text,
        "email" text,
        "name" text,
        "created_at" text NOT NULL,
        "updated_at" text NOT NULL,
        "status" text NOT NULL,
        "admin" boolean NOT NULL DEFAULT false
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS "messages" (
        "id" serial PRIMARY KEY NOT NULL,
        "sender" text NOT NULL,
        "text" text NOT NULL,
        "timestamp" text NOT NULL,
        "ticket_id" text REFERENCES "tickets"("id") ON DELETE CASCADE
      );
    `;

    console.log("Migration completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }

  await sql.end();
  process.exit(0);
}

main();
