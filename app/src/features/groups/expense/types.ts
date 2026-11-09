// 07 費用の分担メモの型(EXP 4.1)。
import type { Id, DateStr, IsoDateTime, Page } from "@/lib/groups-types";
import type { GroupStatus } from "@/features/groups/lifecycle/types";

export type YenAmount = number;

/** 保存形(db().expenses の要素)。 */
export interface ExpenseNote {
  id: Id;
  groupId: Id;
  title: string;
  amount: YenAmount;
  payerId: Id;
  targetIds: Id[];
  spentOn: DateStr;
  memo: string;
  version: number;
  createdBy: Id;
  createdAt: IsoDateTime;
  updatedBy: Id;
  updatedAt: IsoDateTime;
}

export interface ExpenseInput {
  title: string;
  amount: number;
  payerId: Id;
  targetIds: Id[];
  spentOn: DateStr;
  memo?: string;
  ackReview?: boolean;
}

export interface ExpenseUpdateInput extends ExpenseInput {
  baseVersion: number;
}

export interface ExpenseNoteView extends ExpenseNote {
  payerName: string;
  payerActive: boolean;
  targets: { userId: Id; displayName: string; active: boolean; share: number }[];
  updatedByName: string;
}

export interface MemberOption {
  userId: Id;
  displayName: string;
}

export interface ExpenseListResult extends Page<ExpenseNoteView> {
  totalAmount: number;
  members: MemberOption[];
  canEdit: boolean;
  groupStatus: GroupStatus;
  groupStatusLabel: string;
  readOnlyReason: string;
}

export interface MemberBalance {
  userId: Id;
  displayName: string;
  active: boolean;
  paid: number;
  owed: number;
  net: number;
}

export interface TransferHint {
  fromUserId: Id;
  toUserId: Id;
  amount: number;
}

export interface ExpenseSummary {
  currency: "JPY";
  totalAmount: number;
  count: number;
  members: MemberBalance[];
  transfers: TransferHint[];
  disclaimer: string;
  rounding: "first-n-get-one-yen";
}
