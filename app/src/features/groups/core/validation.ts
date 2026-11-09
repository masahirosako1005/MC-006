import type { CreateGroupInput, UpdateGroupPatch } from "@/features/groups/types";

/** 01 の項目の検証。失敗は AppError(invalid_input, fields)。 */
export function validateCreateGroupInput(raw: unknown): CreateGroupInput {
  void raw;
  throw new Error("not implemented");
}

export function validateUpdateGroupPatch(raw: unknown): UpdateGroupPatch {
  void raw;
  throw new Error("not implemented");
}

/** 大文字化、ハイフン・空白の除去。形式不正は null。クライアントと共有。 */
export function normalizeInviteCode(raw: string): string | null {
  void raw;
  throw new Error("not implemented");
}
