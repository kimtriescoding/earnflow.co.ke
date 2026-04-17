/**
 * Count words from PDF text layer (not OCR). Scanned PDFs may return 0 words.
 * @param {Buffer} buffer
 * @returns {Promise<{ wordCount: number; emptyText: boolean }>}
 */
export async function countWordsInPdfBuffer(buffer) {
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  const text = String(data.text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return { wordCount: 0, emptyText: true };
  const wordCount = text.split(" ").filter(Boolean).length;
  return { wordCount, emptyText: false };
}
