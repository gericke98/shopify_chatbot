import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

//Connect drizzle to the neon db
const sql = neon(process.env.DATABASE_URL!);
// const db = drizzle(sql, { schema });
const db = drizzle(sql, { schema });

export default db;
