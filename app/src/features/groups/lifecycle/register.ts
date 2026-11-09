// 04 のフック登録(設計 04 LCY-FN-22)。features/bootstrap.ts から import される。
import { registerHook } from "@/lib/hooks";

// TODO(P-2-10): evaluateAll(clock.now()) の呼び出しに置き換える。署名スタブは throw するため、ここでは何もしない。
registerHook("beforeRequest", "lifecycle", () => {});
registerHook("afterClockChange", "lifecycle", () => {});
