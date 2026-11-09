"use client";
// INS-UI-04。スタブ。
import type { Id } from "@/lib/groups-types";

export interface AreaSelectProps { regions: { id: Id; name: string }[]; value: Id | null; onChange(next: Id | null): void; disabled?: boolean }
export function AreaSelect(props: AreaSelectProps) { void props; return <div />; }
