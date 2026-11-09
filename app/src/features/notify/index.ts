// 10: 公開 API。他モジュールは @/features/notify だけを import する。
export { notify } from "./publish";
export { resolveRecipients } from "./recipients";
export type {
  NotificationKind, NotifyInput, NotifyResult, ParamsOf, RecipientSpec,
} from "./types";
