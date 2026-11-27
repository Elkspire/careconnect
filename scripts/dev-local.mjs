#!/usr/bin/env node
// Runs the web app and API against the local Supabase stack, for testing by
// hand. apps/*/.env may point at the hosted staging project; this never
// edits them. It passes local values as real environment variables instead,
// which both apps rank above their .env files (Next.js: process.env first;
// Nest's ConfigModule never overrides a variable that is already set).
//
//   pnpm dev:local           start Supabase if needed, refresh demo data, run both apps
//   pnpm dev:local --reset   also wipe the local database back to the seed first
//   pnpm dev:local --seed    refresh demo data only, don't start the apps
//
// See docs/local-testing.md.
import { execSync, spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const WEB_PORT = Number(process.env.WEB_PORT ?? 3000);
const API_PORT = Number(process.env.API_PORT ?? 3001);
const DEMO_ADMIN_PHONE = "+923001110000";
const DB_CONTAINER = `supabase_db_${/^project_id\s*=\s*"([^"]+)"/m.exec(readFileSync(resolve(root, "supabase/config.toml"), "utf8"))[1]}`;

const step = (msg) => console.log(`\n\x1b[36m▸ ${msg}\x1b[0m`);
const fail = (msg) => {
  console.error(`\n\x1b[31m✗ ${msg}\x1b[0m`);
  process.exit(1);
};
const run = (cmd, opts = {}) => spawnSync(cmd, { cwd: root, shell: true, stdio: "inherit", ...opts });
const quiet = (cmd) => {
  try {
    return execSync(cmd, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
};

// ---- 1. Free ports, Docker and the Supabase CLI
const portFree = (port) =>
  new Promise((done) => {
    const server = createServer()
      .once("error", () => done(false))
      .once("listening", () => server.close(() => done(true)))
      .listen(port);
  });
if (!args.has("--seed")) {
  for (const port of [WEB_PORT, API_PORT]) {
    if (!(await portFree(port))) {
      fail(`Port ${port} is already in use, probably another \`pnpm dev\`. Stop it (Ctrl+C in its terminal) and try again.`);
    }
  }
}
if (quiet("supabase --version") === null) {
  fail("The Supabase CLI isn't installed: https://supabase.com/docs/guides/local-development/cli/getting-started");
}
if (quiet("docker info --format {{.ServerVersion}}") === null) {
  fail("Docker isn't running. Start Docker Desktop, wait until it says it's running, then try again.");
}

// ---- 2. Local Supabase
const status = () => {
  const out = quiet("supabase status -o env");
  if (!out) return null;
  const get = (key) => new RegExp(`^${key}="?([^"\\r\\n]+)`, "m").exec(out)?.[1];
  return get("API_URL") && { url: get("API_URL"), anon: get("ANON_KEY"), service: get("SERVICE_ROLE_KEY"), db: get("DB_URL") };
};

let sb = status();
if (!sb) {
  step("Starting local Supabase (the first time downloads images and takes a few minutes)");
  if (run("supabase start").status !== 0) fail("supabase start failed (see above).");
  sb = status();
}
if (!sb) fail("Local Supabase started but `supabase status` reports no API URL.");

// A stack started before the demo admin's number was added to config.toml
// won't know its test OTP; restarting picks the config up (data is kept).
const otpWorks = async (phone) => {
  const r = await fetch(`${sb.url}/auth/v1/otp`, {
    method: "POST",
    headers: { apikey: sb.anon, "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  }).catch(() => null);
  return r?.ok ?? false;
};
if (!(await otpWorks(DEMO_ADMIN_PHONE))) {
  step("Restarting Supabase to load the test sign-in numbers from supabase/config.toml (your data is kept)");
  run("supabase stop");
  if (run("supabase start").status !== 0) fail("supabase start failed (see above).");
  sb = status();
  if (!(await otpWorks(DEMO_ADMIN_PHONE))) fail(`Test sign-in for ${DEMO_ADMIN_PHONE} still fails. Check [auth.sms.test_otp] in supabase/config.toml.`);
}

// ---- 3. Data
if (args.has("--reset")) {
  step("Resetting the local database (migrations + supabase/seed/seed.sql)");
  if (run("supabase db reset").status !== 0) fail("supabase db reset failed (see above).");
}
step("Loading demo data (supabase/seed/demo.sql): today's queue, second branch, admin, junior doctor");
const seed = run(`docker exec -i ${DB_CONTAINER} psql -U postgres -v ON_ERROR_STOP=1 -q`, {
  input: readFileSync(resolve(root, "supabase/seed/demo.sql")),
  stdio: ["pipe", "inherit", "inherit"],
});
if (seed.status !== 0) fail("Loading demo data failed (see above). If the schema changed, try `pnpm dev:local --reset`.");

const banner = `
\x1b[32m✓ Local environment ready\x1b[0m

  Web app      http://localhost:${WEB_PORT}
  API          http://127.0.0.1:${API_PORT}
  Studio       ${sb.url.replace(/:\d+$/, ":54323")}  (browse and edit the local tables)

  Sign in with any of these numbers, code 123456:
    0300 1234567   Dr. Ayesha Khan: owner of two branches (Gulberg, DHA)
    0300 9876543   Receptionist at Gulberg: front desk at /desk/khan-skin-clinic-gulberg
    0300 5556666   Junior doctor at Gulberg (sees assigned patients only)
    0300 1110000   Platform admin: /admin/practitioners
    0300 7654321   Patient: Bilal Ahmed

  Also: /ui-kit (light and dark), /partner (preview)
  SMS, WhatsApp, email and push are switched off: nothing leaves your machine.
`;

if (args.has("--seed")) {
  console.log(banner.replace("Local environment ready", "Demo data refreshed"));
  process.exit(0);
}

// ---- 4. Both apps, pointed at local Supabase
const env = {
  ...process.env,
  // API
  SUPABASE_URL: sb.url,
  SUPABASE_SERVICE_ROLE_KEY: sb.service,
  DATABASE_URL: sb.db,
  WEB_ORIGIN: `http://localhost:${WEB_PORT}`,
  // Web
  NEXT_PUBLIC_SUPABASE_URL: sb.url,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: sb.anon,
  NEXT_PUBLIC_API_URL: `http://127.0.0.1:${API_PORT}`,
};
// Blank, not unset: an empty variable still stops .env filling it in, so a
// real Twilio/WhatsApp/SMTP key in apps/api/.env can't message real people.
for (const key of [
  "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_SMS_FROM",
  "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID",
  "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT",
  "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM",
]) {
  env[key] = "";
}

// The API imports the shared packages from their dist/ folders, which a fresh
// clone doesn't have yet (turbo skips this when nothing changed).
step("Building the shared packages");
if (run("pnpm turbo run build --filter=./packages/* --output-logs=errors-only", { env }).status !== 0) {
  fail("Building packages/* failed (see above).");
}

console.log(banner);
step("Starting the web app and API (Ctrl+C to stop; Supabase keeps running, `supabase stop` stops it)");
// Two processes rather than one `turbo dev`, so each gets its own port:
// Next.js also reads PORT, and would otherwise take the API's.
const children = [
  ["api", "pnpm --filter @careconnect/api dev", { ...env, PORT: String(API_PORT) }, "\x1b[35m"],
  ["web", `pnpm --filter @careconnect/web exec next dev --port ${WEB_PORT}`, env, "\x1b[34m"],
].map(([name, cmd, childEnv, colour]) => {
  const child = spawn(cmd, { cwd: root, env: childEnv, shell: true, stdio: ["ignore", "pipe", "pipe"] });
  const prefix = `${colour}[${name}]\x1b[0m `;
  for (const stream of [child.stdout, child.stderr]) {
    let rest = "";
    stream.on("data", (chunk) => {
      const lines = (rest + chunk).split(/\r?\n/);
      rest = lines.pop();
      for (const line of lines) console.log(prefix + line);
    });
  }
  child.on("exit", (code) => {
    console.log(`${prefix}stopped${code ? ` (exit code ${code})` : ""}`);
    stopAll(code ?? 0);
  });
  return child;
});

let stopping = false;
function stopAll(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null) continue;
    // shell: true puts a shell between us and the app; kill the whole tree.
    if (process.platform === "win32") spawnSync(`taskkill /pid ${child.pid} /T /F`, { shell: true, stdio: "ignore" });
    else child.kill("SIGTERM");
  }
  process.exit(code);
}
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => stopAll(0));
