import path from "node:path";
import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth/guards";
import connectDB from "@/lib/db";
import { getSetting } from "@/models/Settings";
import { submitEarningEvent } from "@/lib/ledger/earnings";
import { logModuleInteraction } from "@/lib/modules/interactions";
import { ok, fail } from "@/lib/api";
import {
  countDistinctAcademicSubmitters,
  findAdminAcademicItemById,
  isWithinWindow,
  maxParticipantsCap,
  userHasBlockingAcademicSubmission,
} from "@/lib/modules/academic";
import { countWordsInPdfBuffer } from "@/lib/academic/pdf-word-count";
import {
  ACADEMIC_PDF_MAX_BYTES,
  isPdfMagic,
  removeAcademicSubmissionPdf,
  saveAcademicSubmissionPdf,
} from "@/lib/academic/submission-pdf";

export const runtime = "nodejs";
export const maxDuration = 120;

function sanitizeOriginalFilename(name) {
  const base = path.basename(String(name || "submission.pdf"));
  const cleaned = base.replace(/[^\w.\- ]/g, "_").slice(0, 120);
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned || "submission"}.pdf`;
}

export async function POST(request) {
  const auth = await requireAuth(["user", "admin"]);
  if (auth.error) return auth.error;
  await connectDB();

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return fail("Submit a PDF using multipart form: assignmentId and file", 400);
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return fail("Invalid form data", 400);
  }

  const assignmentId = String(formData.get("assignmentId") || formData.get("itemId") || "").trim();
  if (!assignmentId || !mongoose.Types.ObjectId.isValid(assignmentId)) return fail("assignmentId required", 400);

  const file = formData.get("file");
  if (!file || typeof file !== "object" || typeof file.arrayBuffer !== "function") {
    return fail("PDF file required", 400);
  }

  const assignment = await findAdminAcademicItemById(assignmentId);
  if (!assignment) return fail("Assignment unavailable", 404);

  const moduleStatus = await getSetting("module_status", {});
  if (moduleStatus?.academic === false) return fail("Academic module is currently disabled", 403);

  const now = new Date();
  const windowCheck = isWithinWindow(now, assignment.metadata?.startsAt, assignment.metadata?.deadline);
  if (!windowCheck.ok) {
    if (windowCheck.reason === "not_started") return fail("This task is not open yet", 400);
    return fail("The deadline for this task has passed", 400);
  }

  if (await userHasBlockingAcademicSubmission(auth.payload.sub, assignment._id)) {
    return fail("You already have a pending or approved submission for this task", 400);
  }

  const cap = maxParticipantsCap(assignment.metadata || {});
  if (cap > 0) {
    const filled = await countDistinctAcademicSubmitters(assignment._id);
    if (filled >= cap) return fail("This task has reached its participant limit", 400);
  }

  const title = String(formData.get("title") || assignment.title || "").trim();
  if (!title) return fail("title required", 400);

  const reward = Number(assignment.reward || 0);
  if (!Number.isFinite(reward) || reward <= 0) return fail("Invalid task reward", 400);

  let buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return fail("Could not read uploaded file", 400);
  }

  if (buffer.length === 0) return fail("Empty file", 400);
  if (buffer.length > ACADEMIC_PDF_MAX_BYTES) {
    return fail(`PDF too large (max ${Math.round(ACADEMIC_PDF_MAX_BYTES / (1024 * 1024))} MB)`, 400);
  }
  if (!isPdfMagic(buffer)) return fail("Only PDF files are allowed", 400);

  const minWords = Math.max(0, Math.floor(Number(assignment.metadata?.minWords ?? 0)));

  let wordCount = 0;
  try {
    const { wordCount: wc, emptyText } = await countWordsInPdfBuffer(buffer);
    wordCount = wc;
    if (minWords > 0) {
      if (emptyText || wordCount < minWords) {
        return fail(
          emptyText
            ? "Could not read text in this PDF. Use a PDF with selectable text (not a scanned image), or contact support."
            : `At least ${minWords} words required (your PDF has about ${wordCount}).`,
          400
        );
      }
    }
  } catch {
    return fail("Could not parse this PDF. Try exporting again or use a different PDF.", 400);
  }

  const originalName = sanitizeOriginalFilename(file.name);

  let storageFile = null;
  try {
    const saved = await saveAcademicSubmissionPdf(buffer, auth.payload.sub, assignment._id);
    storageFile = saved.storageFile;
  } catch {
    return fail("Could not store submission", 500);
  }

  let event;
  try {
    event = await submitEarningEvent({
      userId: auth.payload.sub,
      amount: reward,
      source: "academic",
      metadata: {
        title,
        wordCount,
        itemId: assignment._id.toString(),
        submissionKind: "pdf",
        submissionStorageFile: storageFile,
        submissionOriginalName: originalName,
      },
      status: "pending",
    });
  } catch (err) {
    await removeAcademicSubmissionPdf(storageFile);
    throw err;
  }

  await logModuleInteraction({
    module: "academic",
    action: "submit",
    status: "pending",
    amount: reward,
    itemId: assignment._id,
    userId: auth.payload.sub,
    earningEventId: event._id,
    metadata: {
      title,
      assignmentId: assignment._id.toString(),
      submissionKind: "pdf",
      submissionStorageFile: storageFile,
      submissionOriginalName: originalName,
      wordCount,
    },
  });

  return ok({ data: event }, 201);
}
