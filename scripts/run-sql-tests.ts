import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.error("Set TEST_DATABASE_URL to a SCRATCH Postgres, e.g. postgres://postgres:postgres@localhost:5432/bc_test");
  process.exit(1);
}
const host = new URL(url).hostname;
if (!["localhost", "127.0.0.1", "[::1]"].includes(host) && process.env.ALLOW_REMOTE_TEST_DB !== "1") {
  console.error(`Refusing to run: this script DROPS schema public and "${host}" is not local. Set ALLOW_REMOTE_TEST_DB=1 to override.`);
  process.exit(1);
}

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), "utf8");
const filter = process.argv[2] ?? "";

async function main() {
  const client = new Client({ connectionString: url });
  await client.connect();

  await client.query("drop schema if exists test cascade; drop schema if exists auth cascade; drop schema public cascade; create schema public;");
  await client.query(read("tests", "sql", "00_auth_stub.sql"));
  await client.query(read("tests", "sql", "00_helpers.sql"));
  await client.query(read("schema.sql"));

  const migrations = readdirSync(join(root, "migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const file of migrations) {
    const num = file.slice(0, 4);
    const fixture = join("tests", "sql", "fixtures", `pre_${num}.sql`);
    if (existsSync(join(root, fixture))) await client.query(read(fixture));
    await client.query(read("migrations", file));
    console.log(`applied ${file}`);
  }

  const tests = readdirSync(join(root, "tests", "sql"))
    .filter((f) => /^\d+_.*\.test\.sql$/.test(f) && f.startsWith(filter))
    .sort();
  let failed = 0;
  for (const file of tests) {
    try {
      await client.query("begin");
      await client.query(read("tests", "sql", file));
      console.log(`PASS ${file}`);
    } catch (err) {
      failed++;
      console.error(`FAIL ${file}\n  ${(err as Error).message}`);
    } finally {
      await client.query("rollback");
    }
  }
  await client.end();
  console.log(`\n${tests.length - failed}/${tests.length} SQL test files passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
