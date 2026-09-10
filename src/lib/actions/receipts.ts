'use server';

import { createWorker } from 'tesseract.js';
import { parseReceiptText } from '@/lib/receipt';
import { fail, ok, readableError, type ActionResult } from './shared';

/**
 * Reads a receipt photo with OCR and suggests an amount/description to
 * prefill the expense form — never saves anything itself. Isolated from
 * createExpense/updateExpense on purpose: this is a standalone "scan"
 * step the UI can offer before the real save, not a change to the
 * already-verified expense-creation flow.
 */
export async function scanReceipt(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const file = formData.get('receipt') as File | null;
  if (!file || file.size === 0) return fail('Choose a receipt image first.');

  const buffer = Buffer.from(await file.arrayBuffer());

  let rawText: string;
  try {
    const worker = await createWorker('eng');
    try {
      const { data } = await worker.recognize(buffer);
      rawText = data.text;
    } finally {
      await worker.terminate();
    }
  } catch (error) {
    return fail(readableError(error, 'Could not read that receipt. Try a clearer photo.'));
  }

  const result = parseReceiptText(rawText);
  return ok({ ...result });
}
