import { hash } from "@node-rs/argon2";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { users } from "./schema/users";

async function seed() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const client = postgres(url);
  const db = drizzle(client);

  const passwordHash = await hash("admin", {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });

  await db
    .insert(users)
    .values({
      username: "admin",
      displayName: "Administrator",
      passwordHash,
      role: "admin",
      canRead: true,
      canWrite: true,
      isAdmin: true,
      isActive: true,
    })
    .onConflictDoNothing();

  console.log("Seed complete: admin user created (password: admin)");
  await client.end();
}

seed().catch(console.error);
