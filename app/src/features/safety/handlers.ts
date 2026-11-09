// 09: Route Handler(SAF-API-01〜10、12)。スタブ(P-2-2 で route() の本体に置き換える)。
import { stubRoute } from "@/features/stub";

export const getMyProfileHandler = stubRoute();
export const putMyProfileHandler = stubRoute();
export const getUserProfileHandler = stubRoute<{ userId: string }>();
export const listBlocksHandler = stubRoute();
export const createBlockHandler = stubRoute();
export const deleteBlockHandler = stubRoute<{ userId: string }>();
export const createReportHandler = stubRoute();
export const listMyReportsHandler = stubRoute();
export const getVerificationHandler = stubRoute();
export const postVerificationHandler = stubRoute();
export const listDemoReportsHandler = stubRoute({ demoOnly: true });
