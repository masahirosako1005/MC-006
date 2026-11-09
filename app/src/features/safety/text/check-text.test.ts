import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { assertTextAllowed, checkText } from "./check-text";
import dict from "./dictionary.test.json";

describe("checkText", () => {
  it("T-30 deny と assertTextAllowed", () => {
    expect(checkText("テスト禁止語を含む旅", "group_name").verdict).toBe("deny");
    try {
      assertTextAllowed("テスト禁止語を含む旅", "group_name", "name");
      throw new Error("no throw");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      const a = e as AppError;
      expect(a.code).toBe("invalid_input");
      expect(a.reason).toBe("text_denied");
      expect(a.fields?.name).toContain("テスト禁止語");
    }
  });
  it("T-31 回避表記", () => {
    for (const t of ["て.す.と.禁.止.語", "テ スト禁止語", "ﾃｽﾄ禁止語", "テ​スト禁止語", "テスト禁止語"]) {
      expect(checkText(t, "group_name").verdict).toBe("deny");
    }
  });
  it("T-32 report_body は対象外", () => {
    expect(checkText("テスト禁止語", "report_body").verdict).toBe("ok");
  });
  it("T-33 連絡先", () => {
    for (const t of ["090-1234-5678", "０９０－１２３４－５６７８", "〇九〇-一二三四-五六七八", "test@example.com", "連絡先を教えて"]) {
      expect(checkText(t, "group_description").verdict).toBe("deny");
    }
  });
  it("T-34 誤検知なし", () => {
    const t = "2026-11-09 10:30 集合、予算 3000円、費用は割り勘";
    expect(checkText(t, "plan_note").verdict).toBe("ok");
    expect(checkText(t, "expense_item").verdict).toBe("ok");
  });
  it("T-35 URL は group_name で deny、chat で review", () => {
    expect(checkText("https://example.com", "group_name").verdict).toBe("deny");
    expect(checkText("https://example.com", "chat_message").verdict).toBe("review");
    try {
      assertTextAllowed("https://example.com", "chat_message", "body");
      throw new Error("no throw");
    } catch (e) {
      const a = e as AppError;
      expect(a.reason).toBe("text_review_required");
      expect(a.detail).toEqual({ reviewRequired: true });
    }
    expect(() => assertTextAllowed("https://example.com", "chat_message", "body", { ackReview: true })).not.toThrow();
  });
  it("固定の正例・誤検知例", () => {
    for (const p of dict.positive) {
      const r = checkText(p.text, "group_description");
      expect(r.findings.map((f) => f.ruleId), p.text).toContain(p.ruleId);
    }
    for (const t of dict.negative) expect(checkText(t, "group_description").verdict, t).toBe("ok");
  });
});
