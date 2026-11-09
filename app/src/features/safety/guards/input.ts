// 09: 性別・細かい年齢のクエリ拒否(SAF-FN-27)。クエリだけが対象。
import { invalidInput } from "@/lib/errors";

const PROHIBITED = new Set([
  "gender", "sex", "age", "agemin", "agemax", "agefrom", "ageto", "birthday", "birthdate", "birthyear",
  "性別", "年齢",
]);

export function rejectProhibitedParams(params: URLSearchParams): void {
  const fields: Record<string, string> = {};
  for (const key of params.keys()) {
    if (PROHIBITED.has(key.toLowerCase().replace(/[-_]/g, ""))) fields[key] = "指定できない項目です。";
  }
  if (Object.keys(fields).length > 0) throw invalidInput(fields);
}
