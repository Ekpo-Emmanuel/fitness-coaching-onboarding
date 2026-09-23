import { createHmac, timingSafeEqual } from "node:crypto";

export function signWebhookBody(secret: string, timestamp: string, rawBody: string) {
  const digest = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return `v1=${digest}`;
}

export function verifyWebhookSignature(secret: string, timestamp: string, rawBody: string, header: string) {
  const expected = signWebhookBody(secret, timestamp, rawBody);
  const left = Buffer.from(expected);
  const right = Buffer.from(header);
  return left.length === right.length && timingSafeEqual(left, right);
}
