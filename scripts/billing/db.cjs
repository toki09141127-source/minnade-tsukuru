/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs"),
  path = require("node:path"),
  tls = require("node:tls");
module.exports = async () => {
  const ctx = require("../staging/safety.cjs").load();
  if (ctx.ref !== "fwqucffxdmbdczspkcyr") throw Error("STAGING_ONLY");
  const u = new URL(ctx.env.STAGING_DATABASE_URL);
  if (
    u.hostname !== "aws-0-ap-southeast-2.pooler.supabase.com" ||
    u.username !== "postgres." + ctx.ref ||
    u.port !== "5432" ||
    u.pathname !== "/postgres" ||
    [...u.searchParams].some(([k, v]) => k !== "sslmode" || v !== "require") ||
    u.hash
  )
    throw Error("STAGING_DB_SCOPE");
  const { Client } = require(
    path.join(ctx.env.MVP_TEST_RUNTIME, "node_modules/pg"),
  );
  const ca = path.join(
    process.env.LOCALAPPDATA,
    "minnade-release-private/release52/supabase-prod-ca.crt",
  );
  // Supabase public issuer certificate is not a production credential; hostname verification remains enabled.
  const db = new Client({
    host: u.hostname,
    port: 5432,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: "postgres",
    ssl: {
      rejectUnauthorized: true,
      ca:
        tls.rootCertificates.join("\n") +
        (fs.existsSync(ca) ? "\n" + fs.readFileSync(ca, "utf8") : ""),
    },
    connectionTimeoutMillis: 15000,
    statement_timeout: 30000,
    application_name: "minnade_v24_staging",
  });
  await db.connect();
  return { db, ctx };
};
