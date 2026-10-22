import type { NextConfig } from "next";

const staging = process.env.STAGING_TEST === 'true';
if (staging && process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://fwqucffxdmbdczspkcyr.supabase.co') {
  throw new Error('STAGING_NEXT_TARGET_REJECTED');
}
const nextConfig: NextConfig = {
  distDir: staging && process.env.VERCEL !== '1' ? '.next-staging' : '.next',
};
export default nextConfig;
