import { createHash, timingSafeEqual } from "node:crypto";

const digest = (value: string) => createHash("sha256").update(value).digest();

// True when no token is configured, or the given one matches. Compares digests in constant time.
export const tokenAccepted = (expected: string | undefined, given: string | undefined): boolean => {
  if (!expected) return true;
  if (!given) return false;
  return timingSafeEqual(digest(expected), digest(given));
};

export const bearerToken = (header: string | undefined): string | undefined =>
  header?.match(/^Bearer\s+(\S+)\s*$/i)?.[1];
