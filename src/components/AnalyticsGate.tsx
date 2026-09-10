import { Analytics } from "@vercel/analytics/next";

/**
 * Vercel Web Analytics — how many people reach the page.
 *
 * On in production, off everywhere else. The default is deliberately *on*:
 * this file used to be an opt-in gate reading `NEXT_PUBLIC_ANALYTICS`, and
 * since the package was never actually installed the gate quietly measured
 * nothing for months. Analytics that silently collects nothing is worse than
 * no analytics, because you believe the empty dashboard.
 *
 * `NEXT_PUBLIC_ANALYTICS=0` turns it off again if that is ever wanted.
 *
 * Development and the e2e run are excluded on purpose: there the beacon
 * fetches a debug script from an external host, which is noise in the logs
 * and a failed request in a sandbox. Nothing is sent from a developer's
 * machine either way.
 *
 * The counting still has to be switched on in the Vercel project
 * (Analytics → Enable). Until it is, this ships the beacon and Vercel
 * discards what it sends.
 */
export function AnalyticsGate() {
  const enabled =
    process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_ANALYTICS !== "0";
  if (!enabled) return null;
  return <Analytics />;
}
