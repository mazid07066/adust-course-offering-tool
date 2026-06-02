import crypto from "crypto";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

export function hashStudentPassword(password: string) {
  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  const salt = crypto.randomBytes(16).toString("hex");

  const hash = crypto.scryptSync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });

  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${hash.toString(
    "hex"
  )}`;
}

export function verifyStudentPassword(password: string, storedHash: string) {
  try {
    const parts = storedHash.split("$");

    if (parts.length !== 6 || parts[0] !== "scrypt") {
      return false;
    }

    const n = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    const salt = parts[4];
    const expectedHash = Buffer.from(parts[5], "hex");

    const actualHash = crypto.scryptSync(password, salt, expectedHash.length, {
      N: n,
      r,
      p,
    });

    return crypto.timingSafeEqual(expectedHash, actualHash);
  } catch {
    return false;
  }
}