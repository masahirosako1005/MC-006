// 09: 通報。スタブ(P-2-2)。
import type { DemoUser, Page } from "@/lib/groups-types";
import type { CreateReportInput, Report, ReportView } from "../types";

export function createReport(
  user: Readonly<DemoUser>,
  input: CreateReportInput,
): { report: Report; deduplicated: boolean } {
  void user; void input;
  throw new Error("not implemented");
}

export function listMyReports(user: Readonly<DemoUser>, page: { limit: number; offset: number }): Page<ReportView> {
  void user; void page;
  throw new Error("not implemented");
}
