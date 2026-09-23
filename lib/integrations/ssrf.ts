import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.goog",
  "169.254.169.254",
  "metadata.google.internal.",
]);

export type LookupFn = (host: string) => Promise<Array<{ address: string }>>;

function isPrivateIpv4(ip: string) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIpv6(ip: string) {
  const value = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (value === "::1" || value === "0:0:0:0:0:0:0:1") return true;
  if (value.startsWith("fe80:") || value.startsWith("fc") || value.startsWith("fd")) return true;
  if (value.startsWith("ff")) return true;
  if (value.startsWith("::ffff:")) return isPrivateIpv4(value.slice(7));
  return false;
}

export function isPrivateAddress(ip: string) {
  const version = isIP(ip);
  if (version === 4) return isPrivateIpv4(ip);
  if (version === 6) return isPrivateIpv6(ip);
  return true;
}

async function defaultLookup(host: string) {
  return dnsLookup(host, { all: true });
}

export async function assertSafeWebhookUrl(
  raw: string,
  options?: { allowHttpLocal?: boolean; lookup?: LookupFn },
) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Enter a valid webhook URL.");
  }
  if (url.username || url.password) throw new Error("Webhook URLs cannot include credentials.");
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".localhost") || host === "[::1]" || host === "::1") {
    if (!options?.allowHttpLocal) throw new Error("That webhook host is not allowed.");
  }
  const allowHttp = Boolean(options?.allowHttpLocal);
  if (url.protocol !== "https:" && !(allowHttp && url.protocol === "http:")) {
    throw new Error("Webhook URLs must use HTTPS.");
  }
  if (isIP(host) && isPrivateAddress(host) && !allowHttp) {
    throw new Error("That webhook host is not allowed.");
  }
  if (!isIP(host)) {
    const resolved = await (options?.lookup ?? defaultLookup)(host);
    if (!resolved.length) throw new Error("That webhook host is not allowed.");
    for (const item of resolved) {
      if (isPrivateAddress(item.address) && !allowHttp) {
        throw new Error("That webhook host is not allowed.");
      }
    }
  }
  return url.toString();
}

export function webhookHttpAllowed() {
  return process.env.NODE_ENV !== "production";
}
