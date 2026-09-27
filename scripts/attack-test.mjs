#!/usr/bin/env node
/**
 * Attack suite: tries to break business isolation through the public API, exactly as an
 * outsider holding the (public) publishable key and their own login would.
 *
 *   node --env-file=.env.local scripts/attack-test.mjs
 *
 * Needs two confirmed test accounts in two different businesses:
 *   ATTACK_A_EMAIL, ATTACK_B_EMAIL, ATTACK_PASSWORD
 * Each account must not have two-step verification set up yet; the script enrols a
 * fresh authenticator for each and computes the codes itself.
 */
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const { ATTACK_A_EMAIL, ATTACK_B_EMAIL, ATTACK_PASSWORD } = process.env;
if (!url || !key || !ATTACK_A_EMAIL || !ATTACK_B_EMAIL || !ATTACK_PASSWORD) {
  console.error(
    "Missing env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, ATTACK_A_EMAIL, ATTACK_B_EMAIL, ATTACK_PASSWORD",
  );
  process.exit(2);
}

const results = [];
function check(name, passed, detail = "") {
  results.push({ name, passed });
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}
const denied = (res) => Boolean(res.error) || (Array.isArray(res.data) && res.data.length === 0);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const client = () =>
  createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function signIn(email) {
  const c = client();
  const { data, error } = await c.auth.signInWithPassword({ email, password: ATTACK_PASSWORD });
  if (error) throw new Error(`sign in failed for ${email}: ${error.message}`);
  return { c, session: data.session, userId: data.user.id };
}

function base32(secret) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of secret.replace(/=+$/, "").toUpperCase()) {
    const v = alphabet.indexOf(ch);
    if (v >= 0) bits += v.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function totp(secret) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const h = createHmac("sha1", base32(secret)).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

async function passTwoStep(c) {
  const enrolled = await c.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `attack-test-${Date.now()}`,
  });
  if (enrolled.error) throw new Error(`enrol failed: ${enrolled.error.message}`);
  const verified = await c.auth.mfa.challengeAndVerify({
    factorId: enrolled.data.id,
    code: totp(enrolled.data.totp.secret),
  });
  if (verified.error) throw new Error(`verify failed: ${verified.error.message}`);
  c.realtime.setAuth(verified.data.access_token);
  return verified.data.access_token;
}

console.log("\n-- 1. No login at all (anyone on the internet with the public key) --");
{
  const anon = client();
  for (const table of ["jobs", "costs", "businesses", "memberships"]) {
    check(`anonymous cannot read ${table}`, denied(await anon.from(table).select("*").limit(1)));
  }
  check("anonymous cannot call dashboard()", Boolean((await anon.rpc("dashboard")).error));
  check("anonymous cannot load sample data", Boolean((await anon.rpc("load_sample_month")).error));
  check(
    "anonymous cannot insert a job",
    Boolean((await anon.from("jobs").insert({ customer: "x", amount_cents: 100 })).error),
  );
  check(
    "audit log is not reachable through the API",
    Boolean((await anon.schema("audit").from("events").select("*").limit(1)).error),
  );
}

console.log("\n-- 2. Correct password, no second factor (a stolen password) --");
const a = await signIn(ATTACK_A_EMAIL);
const b = await signIn(ATTACK_B_EMAIL);
const aalOf = (token) => JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).aal;
check("password-only session is only aal1", aalOf(a.session.access_token) === "aal1");
check("password-only session sees no businesses", denied(await a.c.from("businesses").select("*")));
check(
  "password-only session cannot add a job",
  Boolean((await a.c.from("jobs").insert({ customer: "stolen", amount_cents: 100 })).error),
);
check(
  "password-only session cannot load sample data",
  Boolean((await a.c.rpc("load_sample_month")).error),
);

console.log("\n-- 3. Two real businesses, fully signed in --");
const aToken = await passTwoStep(a.c);
await passTwoStep(b.c);

const aBiz = (await a.c.from("businesses").select("id, name")).data ?? [];
const bBiz = (await b.c.from("businesses").select("id, name")).data ?? [];
check("each login sees exactly one business", aBiz.length === 1 && bBiz.length === 1);
check("A and B are different businesses", aBiz[0]?.id && aBiz[0]?.id !== bBiz[0]?.id);
const aId = aBiz[0].id;
const bId = bBiz[0].id;

await a.c.rpc("load_sample_month");
await b.c.rpc("load_sample_month");
const secret = `B-secret-${Date.now()}`;
const bJobId = crypto.randomUUID();
check(
  "B can add its own job",
  !(await b.c.from("jobs").insert({ id: bJobId, customer: secret, amount_cents: 99900 })).error,
);

console.log("\n-- 4. A attacks B --");
const aJobs = (await a.c.from("jobs").select("id, business_id, customer")).data ?? [];
check("A's job list is not empty", aJobs.length > 0, `${aJobs.length} rows`);
check(
  "every job A can see belongs to A",
  aJobs.every((j) => j.business_id === aId),
);
check("A cannot see B's secret job", !aJobs.some((j) => j.customer === secret));
check("A cannot fetch B's job by id", denied(await a.c.from("jobs").select("*").eq("id", bJobId)));
check(
  "A cannot filter by B's business id",
  denied(await a.c.from("jobs").select("*").eq("business_id", bId)),
);
check(
  "A cannot read B's costs",
  denied(await a.c.from("costs").select("*").eq("business_id", bId)),
);
check("A cannot read B's business", denied(await a.c.from("businesses").select("*").eq("id", bId)));
check("A cannot read memberships", denied(await a.c.from("memberships").select("*")));

const dash = (await a.c.rpc("dashboard")).data;
check(
  "A's dashboard() contains only A's business",
  dash?.business?.id === aId && !JSON.stringify(dash).includes(secret),
);

check(
  "A cannot insert a job into B's business",
  Boolean(
    (await a.c.from("jobs").insert({ customer: "plant", amount_cents: 100, business_id: bId }))
      .error,
  ),
);
check(
  "A cannot forge the author of a job",
  Boolean(
    (await a.c.from("jobs").insert({ customer: "forge", amount_cents: 100, created_by: b.userId }))
      .error,
  ),
);
check(
  "A cannot void B's job",
  denied(
    await a.c
      .from("jobs")
      .update({ voided_at: new Date().toISOString() })
      .eq("id", bJobId)
      .select(),
  ),
);

console.log("\n-- 5. A tampers with A's own books --");
const ownId = crypto.randomUUID();
await a.c.from("jobs").insert({ id: ownId, customer: "Own job", amount_cents: 12300 });
check(
  "A cannot change a job's amount",
  Boolean((await a.c.from("jobs").update({ amount_cents: 1 }).eq("id", ownId)).error),
);
check(
  "A cannot move a job to another business",
  Boolean((await a.c.from("jobs").update({ business_id: bId }).eq("id", ownId)).error),
);
check("A cannot delete a job", denied(await a.c.from("jobs").delete().eq("id", ownId).select()));
const voided = await a.c
  .from("jobs")
  .update({ voided_at: new Date().toISOString() })
  .eq("id", ownId)
  .select("id");
check("A can void its own fresh job (Undo)", !voided.error && voided.data.length === 1);
check(
  "a voided job cannot be un-voided",
  denied(await a.c.from("jobs").update({ voided_at: null }).eq("id", ownId).select()),
);
const costsBefore = (await a.c.from("costs").select("id")).data.length;
await a.c.rpc("load_sample_month");
check(
  "sample data can't be loaded twice",
  (await a.c.from("costs").select("id")).data.length === costsBefore,
);

console.log("\n-- 6. Forged tokens --");
const [header, payload, signature] = aToken.split(".");
const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
const forgedPayload = Buffer.from(JSON.stringify({ ...claims, sub: b.userId })).toString(
  "base64url",
);
const forged = await fetch(`${url}/rest/v1/jobs?select=id`, {
  headers: { apikey: key, Authorization: `Bearer ${header}.${forgedPayload}.${signature}` },
});
check(
  "a token edited to impersonate B is rejected",
  forged.status === 401,
  `HTTP ${forged.status}`,
);

console.log("\n-- 7. Realtime eavesdropping --");
const heard = { own: 0, other: 0 };
const spy = a.c
  .channel("spy")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "jobs", filter: `business_id=eq.${bId}` },
    () => heard.other++,
  )
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "jobs", filter: `business_id=eq.${aId}` },
    () => heard.own++,
  );
await new Promise((resolve) => spy.subscribe((status) => status === "SUBSCRIBED" && resolve()));
await wait(1500);
await b.c.from("jobs").insert({ customer: "B live", amount_cents: 5000 });
await a.c.from("jobs").insert({ customer: "A live", amount_cents: 5000 });
await wait(5000);
check("A hears its own live updates (control)", heard.own >= 1, `${heard.own} event(s)`);
check("A hears nothing from B's business", heard.other === 0, `${heard.other} event(s)`);
await a.c.removeChannel(spy);

const failed = results.filter((r) => !r.passed).length;
console.log(
  `\n${results.length - failed}/${results.length} attacks blocked${failed ? `, ${failed} FAILED` : ""}.`,
);
process.exit(failed ? 1 : 0);
