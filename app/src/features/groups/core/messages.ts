// 01 の画面・エラー文言(日本語)。
export const GROUP_MESSAGES: Record<string, string> = {
  organizerGroupLimit: "進行中のグループが上限に達しています。終了または中止の後に作成できます",
  groupIsPublic: "公開グループには招待コードはありません。非公開に切り替えると発行できます",
  capacityBelowMembers: "人数上限が現在の人数または最少人数を下回っています",
  fieldNotEditable: "現在の状態ではこの項目は変更できません",
  invalidRegion: "地方を選んでください",
  invalidCampaign: "キャンペーンを選び直してください",
  tripOrder: "終了日は開始日以降にしてください",
  tripLength: "期間は 14 日以内にしてください",
  tripAhead: "開始日は今日から 365 日以内にしてください",
  deadlineBeforeStart: "開始日は締切日より後にしてください",
  tagsDuplicate: "同じタグは重複できません",
  inviteTerminal: "終了したグループでは招待コードを発行できません",
  groupFull: "人数上限に達しています",
  alreadyMember: "既にメンバーです",
  versionMismatch: "他の更新と競合しました。再読み込みしてください",
};
