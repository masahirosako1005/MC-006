"use client";
// 09: ブロックの導線。スタブ(P-3-11 で本体に置き換える)。
export interface BlockMenuItemProps {
  userId: string;
  displayName: string;
  groupId?: string;
  onBlocked?(): void;
}

export function BlockMenuItem(props: BlockMenuItemProps) {
  void props;
  return null;
}
