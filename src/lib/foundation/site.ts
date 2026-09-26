/**
 * The site's public origin, for absolute Open Graph / Twitter URLs.
 *
 * `NEXT_PUBLIC_SITE_URL` wins when set; on Vercel the production domain (or
 * the deployment URL for previews) is used; locally it is localhost.
 */
export function resolveSiteUrl(env: Record<string, string | undefined> = process.env): string {
  const explicit = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return withProtocol(explicit);
  const vercel = env.VERCEL_ENV === "production" ? env.VERCEL_PROJECT_PRODUCTION_URL : env.VERCEL_URL;
  if (vercel?.trim()) return withProtocol(vercel.trim());
  return `http://localhost:${env.PORT?.trim() || "3000"}`;
}

function withProtocol(value: string): string {
  const url = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return url.replace(/\/+$/, "");
}

/** `metadataBase` for the root layout; falls back to localhost on a bad value. */
export function siteMetadataBase(env?: Record<string, string | undefined>): URL {
  try {
    return new URL(resolveSiteUrl(env));
  } catch {
    return new URL("http://localhost:3000");
  }
}
