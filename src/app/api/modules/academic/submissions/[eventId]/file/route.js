import fs from "node:fs/promises";
import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth/guards";
import connectDB from "@/lib/db";
import EarningEvent from "@/models/EarningEvent";
import { fail } from "@/lib/api";
import { resolveAcademicSubmissionPdfPath } from "@/lib/academic/submission-pdf";

export const runtime = "nodejs";

export async function GET(_request, { params }) {
  const auth = await requireAuth(["user", "admin", "support"]);
  if (auth.error) return auth.error;

  const eventId = String((await params).eventId || "").trim();
  if (!mongoose.Types.ObjectId.isValid(eventId)) return fail("Invalid id", 400);

  await connectDB();
  const event = await EarningEvent.findById(eventId).lean();
  if (!event || event.source !== "academic") return fail("Not found", 404);

  const isStaff = auth.payload.role === "admin" || auth.payload.role === "support";
  const isOwner = String(event.userId) === String(auth.payload.sub);
  if (!isStaff && !isOwner) return fail("Forbidden", 403);

  const storageFile = event.metadata?.submissionStorageFile;
  const legacyUrl = String(event.metadata?.submissionUrl || "").trim();

  if (storageFile) {
    const fullPath = resolveAcademicSubmissionPdfPath(storageFile);
    if (!fullPath) return fail("Invalid file reference", 400);
    try {
      const buf = await fs.readFile(fullPath);
      const orig = String(event.metadata?.submissionOriginalName || "submission.pdf").replace(/[^\w.\- ]/g, "_");
      return new Response(buf, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${orig}"`,
          "Cache-Control": "private, no-store",
        },
      });
    } catch {
      return fail("File not found", 404);
    }
  }

  if (legacyUrl) {
    return Response.redirect(legacyUrl, 302);
  }

  return fail("No submission file", 404);
}
