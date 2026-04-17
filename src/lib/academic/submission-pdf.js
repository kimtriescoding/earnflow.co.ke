import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const ACADEMIC_PDF_MAX_BYTES = 12 * 1024 * 1024;

const STORAGE_DIR = path.resolve(process.cwd(), "uploads", "academic");

/** @param {Buffer} buf */
export function isPdfMagic(buf) {
  if (!buf || buf.length < 5) return false;
  return buf.subarray(0, 5).toString("ascii") === "%PDF-";
}

export function isValidStoredAcademicPdfName(name) {
  return /^ac-[a-f0-9]+-[a-f0-9]+-[0-9a-f-]{36}\.pdf$/i.test(String(name || ""));
}

function isPathInsideStorage(resolvedFile) {
  const rel = path.relative(STORAGE_DIR, resolvedFile);
  return Boolean(rel && !rel.startsWith("..") && !path.isAbsolute(rel));
}

export async function saveAcademicSubmissionPdf(buffer, userId, assignmentId) {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
  const safeUser = String(userId).replace(/[^a-f0-9]/gi, "");
  const safeAssign = String(assignmentId).replace(/[^a-f0-9]/gi, "");
  const storageFile = `ac-${safeUser}-${safeAssign}-${randomUUID()}.pdf`;
  const fullPath = path.resolve(STORAGE_DIR, storageFile);
  await fs.writeFile(fullPath, buffer);
  return { storageFile, fullPath };
}

export async function removeAcademicSubmissionPdf(storageFile) {
  const fullPath = resolveAcademicSubmissionPdfPath(storageFile);
  if (!fullPath) return;
  await fs.unlink(fullPath).catch(() => {});
}

/** @returns {string | null} absolute path to file */
export function resolveAcademicSubmissionPdfPath(storageFile) {
  if (!isValidStoredAcademicPdfName(storageFile)) return null;
  const base = path.basename(storageFile);
  const fullPath = path.resolve(STORAGE_DIR, base);
  if (!isPathInsideStorage(fullPath)) return null;
  return fullPath;
}
