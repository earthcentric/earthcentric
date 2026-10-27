import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: new URL(".env", import.meta.url).pathname.slice(1) });

const sql = neon(process.env.DATABASE_URL);

const migrations = [
  new URL("prisma/add-order-cancellations.sql", import.meta.url).pathname.slice(1),
  new URL("prisma/deduplicate-product-reviews.sql", import.meta.url).pathname.slice(1),
];

for (const file of migrations) {
  const name = path.basename(file);
  console.log(`\nRunning: ${name}`);
  const sqlText = readFileSync(file, "utf8");
  try {
    await sql(sqlText);
    console.log(`SUCCESS: ${name}`);
  } catch (err) {
    if (
      err.message.includes("already exists") ||
      err.message.includes("duplicate")
    ) {
      console.log(`SKIPPED (already applied): ${name} -- ${err.message}`);
    } else {
      console.error(`FAILED: ${name} -- ${err.message}`);
      process.exit(1);
    }
  }
}

console.log("\nAll migrations done.");
