import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

/**
 * AES-256-GCM encryption for credentials at rest. The key is derived from
 * CREDENTIALS_SECRET (or JWT_SECRET) — set a strong one in production.
 * Payload format: base64(iv):base64(authTag):base64(ciphertext).
 */
function key() {
  const secret =
    process.env.CREDENTIALS_SECRET ||
    process.env.JWT_SECRET ||
    "phyt-dev-secret-change-me";
  return scryptSync(secret, "phyt-cred-salt", 32);
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    tag.toString("base64"),
    enc.toString("base64"),
  ].join(":");
}

export function decrypt(payload: string): string {
  const [ivb, tagb, encb] = payload.split(":");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivb, "base64"));
  decipher.setAuthTag(Buffer.from(tagb, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encb, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
