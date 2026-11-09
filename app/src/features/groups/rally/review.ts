// 08: 振り返り(メモ・アンケート・ダミー写真)。スタブ(P-2-21)。
import type { DemoUser, Id } from "@/lib/groups-types";
import type { PhotoPostDto, ReviewDto, ReviewMemoDto, SurveyAnswerDto, SurveyInput } from "./types";

export function getReview(user: DemoUser, groupId: Id): ReviewDto {
  void user; void groupId;
  throw new Error("not implemented");
}

export function saveMemo(user: DemoUser, groupId: Id, input: { body: string; ackReview?: boolean }): ReviewMemoDto {
  void user; void groupId; void input;
  throw new Error("not implemented");
}

export function saveSurvey(user: DemoUser, groupId: Id, input: SurveyInput): SurveyAnswerDto {
  void user; void groupId; void input;
  throw new Error("not implemented");
}

export function addPhotoPost(
  user: DemoUser,
  groupId: Id,
  input: { spotId?: number | null; caption: string; ackReview?: boolean },
): PhotoPostDto {
  void user; void groupId; void input;
  throw new Error("not implemented");
}

export function removePhotoPost(user: DemoUser, groupId: Id, photoId: Id): void {
  void user; void groupId; void photoId;
  throw new Error("not implemented");
}
