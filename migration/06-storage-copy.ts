/**
 * Step 5 — Copy the storage bucket from the OLD project to the NEW one.
 *
 *   bun run migration/06-storage-copy.ts [--dry-run]
 *   (or: npx tsx migration/06-storage-copy.ts)
 *
 * Copies every object in STORAGE_BUCKET (default: business-photos) at the
 * IDENTICAL path, so every stored URL in business_photos.url,
 * businesses.featured_image and businesses.catalog_url keeps resolving after
 * you swap the project host.
 *
 * The old bucket is private, so objects are read through signed URLs created
 * with the old anon key — read-only, nothing on the old project is modified.
 * Idempotent: objects already present in the destination are skipped.
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes("--dry-run");

loadEnvFile(resolve(HERE, ".env"));

const BUCKET = process.env["STORAGE_BUCKET"] || "business-photos";
const oldClient = createClient(requireEnv("OLD_SUPABASE_URL"), requireEnv("OLD_ANON_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const newClient = createClient(
  requireEnv("NEW_SUPABASE_URL"),
  requireEnv("NEW_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } },
);

type Obj = { path: string; size: number; mimetype?: string };

async function main() {
  console.log(`Bucket: ${BUCKET}\n`);

  // 1. Make sure the destination bucket exists (private, same as source).
  if (!DRY_RUN) {
    const { data: buckets } = await newClient.storage.listBuckets();
    if (!buckets?.some((b) => b.name === BUCKET)) {
      const { error } = await newClient.storage.createBucket(BUCKET, { public: false });
      if (error) throw error;
      console.log(`Created bucket "${BUCKET}" (private) in the new project.`);
    }
  }

  // 2. Walk the source bucket recursively.
  const objects = await listAll(BUCKET, "");
  console.log(`Found ${objects.length} objects in the source bucket.\n`);

  // 3. Skip anything already copied.
  const destination = DRY_RUN ? [] : await listAllDest(BUCKET, "");
  const present = new Set(destination.map((o) => o.path));

  let copied = 0;
  let skipped = 0;
  const failed: Array<{ path: string; reason: string }> = [];

  for (const obj of objects) {
    if (present.has(obj.path)) {
      skipped++;
      continue;
    }
    if (DRY_RUN) {
      console.log(`  [dry-run] copy ${obj.path} (${obj.size} bytes)`);
      copied++;
      continue;
    }

    try {
      const { data: signed, error: signErr } = await oldClient.storage
        .from(BUCKET)
        .createSignedUrl(obj.path, 300);
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error("no signed url");

      const res = await fetch(signed.signedUrl);
      if (!res.ok) throw new Error(`download ${res.status}`);
      const body = new Uint8Array(await res.arrayBuffer());

      const { error: upErr } = await newClient.storage.from(BUCKET).upload(obj.path, body, {
        contentType: obj.mimetype || res.headers.get("content-type") || undefined,
        upsert: true,
      });
      if (upErr) throw upErr;

      copied++;
      console.log(`  ok   ${obj.path}  (${body.byteLength} bytes)`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      failed.push({ path: obj.path, reason });
      console.log(`  FAIL ${obj.path}: ${reason}`);
    }
  }

  console.log(`\ncopied=${copied}  skipped(already there)=${skipped}  failed=${failed.length}`);

  // 4. Verify: destination count must be >= source count.
  if (!DRY_RUN) {
    const after = await listAllDest(BUCKET, "");
    console.log(`\nSource objects: ${objects.length}   Destination objects: ${after.length}`);
    if (after.length < objects.length) {
      console.log("MISMATCH — do not continue to cutover until this is resolved.");
      process.exit(1);
    }
    console.log("Storage verified.");
  }

  if (failed.length) process.exit(1);

  console.log(`
Reminder: any absolute URLs stored in the database still point at the OLD
project host. Check with:

  select count(*) from public.business_photos where url like '%lovable.cloud%';
  select count(*) from public.businesses
    where featured_image like '%lovable.cloud%' or catalog_url like '%lovable.cloud%';

If those are non-zero, rewrite the host in a migration on the NEW project:

  update public.business_photos
     set url = replace(url, '<OLD_HOST>', '<NEW_HOST>')
   where url like '%<OLD_HOST>%';`);
}

// --- helpers -------------------------------------------------------------

async function listAll(bucket: string, prefix: string): Promise<Obj[]> {
  return walk(oldClient, bucket, prefix);
}
async function listAllDest(bucket: string, prefix: string): Promise<Obj[]> {
  return walk(newClient, bucket, prefix);
}

async function walk(
  client: ReturnType<typeof createClient>,
  bucket: string,
  prefix: string,
): Promise<Obj[]> {
  const out: Obj[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await client.storage
      .from(bucket)
      .list(prefix, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      // Folders come back with a null id.
      if (entry.id === null) {
        out.push(...(await walk(client, bucket, path)));
      } else {
        out.push({
          path,
          size: (entry.metadata?.["size"] as number) ?? 0,
          mimetype: entry.metadata?.["mimetype"] as string | undefined,
        });
      }
    }
    if (data.length < 100) break;
    offset += data.length;
  }
  return out;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`${name} is not set. Fill in migration/.env (see .env.example).`);
    process.exit(1);
  }
  return v;
}

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1]!;
    let val = m[2]!.trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
