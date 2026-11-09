// 03 の画面文言(設計 03 §7.3)。
export function consentText(minMembers: number): string {
  return `このグループは、最少人数(${minMembers}人)でも実行されます。${minMembers}人になっても参加します。実行が確定する前なら、辞退できます(不利益はありません)。`;
}
