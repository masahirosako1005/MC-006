// 03 のイベント購読の登録(features/bootstrap.ts から import される)。
import { on } from "@/lib/events";

// TODO(P-2-8): expireOnStatusChanged に置き換える。署名スタブは throw するため、ここでは何もしない。
on("status_changed", "join", () => {});
