// デモ API(/api/demo/*)のハンドラ(CMN-API-01〜06)。署名スタブ(P-1-3 で実装)。
// app/api/demo/*/route.ts はここからの再エクスポートだけを書く(P-0-2)。
import { route } from "./api-route";

const ni = (): never => { throw new Error("not implemented"); };

export const getMeHandler = route(() => ni(), { auth: "none" });
export const postMeHandler = route(() => ni(), { demoOnly: true });
export const getUsersHandler = route(() => ni(), { demoOnly: true });
export const getClockHandler = route(() => ni());
export const postClockHandler = route(() => ni(), { demoOnly: true });
export const postResetHandler = route(() => ni(), { demoOnly: true, skipHooks: true });
