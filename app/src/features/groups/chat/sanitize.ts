// 06 本文の整形・検証(CHT-FN-10、11)。
import { invalidInput } from "@/lib/errors";
import { LIMITS } from "@/lib/limits";
import { sanitizeText } from "@/lib/validation";
import { CHAT_MESSAGES } from "./messages";

export function normalizeBody(raw: unknown): string {
  if (typeof raw !== "string") throw invalidInput({ body: CHAT_MESSAGES.bodyNotString });
  return sanitizeText(raw, { multiline: true });
}

export function validateBody(body: string): { ok: true } | { ok: false; message: string } {
  const len = Array.from(body).length;
  if (len < LIMITS.CHAT.min) return { ok: false, message: CHAT_MESSAGES.bodyRequired };
  if (len > LIMITS.CHAT.max) return { ok: false, message: CHAT_MESSAGES.bodyTooLong(LIMITS.CHAT.max) };
  if (body.split("\n").length > LIMITS.CHAT.maxLines) {
    return { ok: false, message: CHAT_MESSAGES.bodyTooManyLines(LIMITS.CHAT.maxLines) };
  }
  return { ok: true };
}
