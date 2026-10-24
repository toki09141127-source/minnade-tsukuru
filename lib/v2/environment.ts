// Server configuration; never accept these values from a client request.
export const STAGING_URL = "https://fwqucffxdmbdczspkcyr.supabase.co";
export const PRODUCTION_URL = "https://joedeuyrzimqyjapqpyh.supabase.co";
export function stagingEnvironment() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL === STAGING_URL && process.env.VERCEL_ENV !== "production";
}
export function productionEnvironment() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL === PRODUCTION_URL && process.env.VERCEL_ENV === "production";
}
export function freeProductionRelease() {
  return productionEnvironment() && process.env.V2_RELEASE_MODE === "free" && process.env.V2_SCHEMA_VERSION === "58";
}
// Retirement is independent of the UI switch, including after a UI rollback.
export function v2SchemaRequired() {
  return process.env.V2_SCHEMA_VERSION === "58" || process.env.V2_ENABLED === "true" || stagingEnvironment();
}
