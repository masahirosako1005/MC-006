"use client";
// 09: 本人確認が要る操作の入口。スタブ(P-3-11 で本体に置き換える)。
import type { ReactNode } from "react";
import type { VerifiedAction } from "../types";

export function VerificationGate(props: { action: VerifiedAction; children: ReactNode }) {
  return <>{props.children}</>;
}
