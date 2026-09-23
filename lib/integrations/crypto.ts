import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { parseEncryptionKey } from "@/lib/config";

const VERSION = "v1";

function keyBytes() {
  return parseEncryptionKey(process.env.INTEGRATION_ENCRYPTION_KEY);
}

export function encryptSecret(plaintext: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptSecret(envelope: string) {
  const [version, ivPart, tagPart, dataPart] = envelope.split(".");
  if (version !== VERSION || !ivPart || !tagPart || !dataPart) {
    throw new Error("Invalid credential envelope.");
  }
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]).toString("utf8");
}

export function encryptJson(value: unknown) {
  return encryptSecret(JSON.stringify(value));
}

export function decryptJson<T>(envelope: string): T {
  return JSON.parse(decryptSecret(envelope)) as T;
}
