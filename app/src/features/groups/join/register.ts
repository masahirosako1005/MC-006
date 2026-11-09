// 03 のイベント購読の登録(features/bootstrap.ts から import される)。
import { on } from "@/lib/events";
import { expireOnStatusChanged } from "./expire";

on("status_changed", "join", (e) => {
  expireOnStatusChanged(e);
});
