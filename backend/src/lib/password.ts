import bcrypt from "bcryptjs";

const ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function validatePasswordComplexity(pw: string): string | null {
  if (pw.length < 10) return "Password must be at least 10 characters.";
  if (!/[A-Z]/.test(pw)) return "Password must include an uppercase letter.";
  if (!/[a-z]/.test(pw)) return "Password must include a lowercase letter.";
  if (!/[0-9]/.test(pw)) return "Password must include a digit.";
  return null;
}
