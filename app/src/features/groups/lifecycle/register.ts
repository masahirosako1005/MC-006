// 04 のフック登録(設計 04 LCY-FN-22)。features/bootstrap.ts から import される。
import { registerHook } from "@/lib/hooks";
import { clock } from "@/lib/clock";
import { evaluateAll } from "./evaluate";

registerHook("beforeRequest", "lifecycle", () => { evaluateAll(clock.now()); });
registerHook("afterClockChange", "lifecycle", () => { evaluateAll(clock.now()); });
