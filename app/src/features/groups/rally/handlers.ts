// 08: Route Handler(RLY-API-01〜07)。スタブ(P-2-21 で route() の本体に置き換える)。
import { stubRoute } from "@/features/stub";
import type { GroupParams } from "@/features/stub";

export const getRallyHandler = stubRoute<GroupParams>();
export const postStampHandler = stubRoute<GroupParams>();
export const getReviewHandler = stubRoute<GroupParams>();
export const putMemoHandler = stubRoute<GroupParams>();
export const putSurveyHandler = stubRoute<GroupParams>();
export const postPhotoHandler = stubRoute<GroupParams>();
export const deletePhotoHandler = stubRoute<{ groupId: string; photoId: string }>();
