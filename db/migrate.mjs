import postgres from "postgres";

// Read the database URL from environment variables
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL environment variable is not set");
  process.exit(1);
}

// Connect to the database with SSL enabled for Vercel
console.log("Connecting to database...");
const sql = postgres(databaseUrl, {
  ssl: { rejectUnauthorized: false },
  max: 1,
});

// Run migrations
async function main() {
  console.log("Running migrations...");

  try {
    // Log database connection info
    console.log("Database connection established");

    // Create tables directly if they don't exist
    console.log("Creating tickets table...");
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
    console.log("Tickets table created successfully");

    console.log("Creating messages table...");
    await sql`
      CREATE TABLE IF NOT EXISTS "messages" (
        "id" serial PRIMARY KEY NOT NULL,
        "sender" text NOT NULL,
        "text" text NOT NULL,
        "timestamp" text NOT NULL,
        "ticket_id" text REFERENCES "tickets"("id") ON DELETE CASCADE
      );
    `;
    console.log("Messages table created successfully");

    // Verify tables were created
    console.log("Verifying tables...");
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `;
    console.log(
      "Tables in database:",
      tables.map((t) => t.table_name)
    );

    console.log("Migration completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
    console.log("Database connection closed");
  }
}

main().catch((err) => {
  console.error("Unhandled error in migration script:", err);
  process.exit(1);
});
