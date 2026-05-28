import bcrypt from "bcryptjs";

function bcryptRounds() {
  const raw = process.env.BCRYPT_ROUNDS;
  if (raw === undefined || raw === "") return 10;
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) && n >= 8 && n <= 14 ? n : 10;
}

export async function hashPassword(password) {
  return bcrypt.hash(password, bcryptRounds());
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}
