// 01 単独の API ハンドラ(契約 8)。route.ts は再エクスポートだけを書く。
import { ok, route } from "@/lib/api-route";
import type { GroupParams } from "@/features/stub";
import {
  getGroup, getInviteCode, issueInviteCode, listMembers, reissueInviteCode, updateGroup,
} from "./service";
import { UpdateGroupBody } from "./validation";

export const patchGroupHandler = route<GroupParams>(async (c) => {
  const id = await c.id("groupId", "g");
  const { ackReview, ...patch } = await c.body(UpdateGroupBody);
  updateGroup(c.user, id, patch, { ackReview });
  return ok(getGroup(c.user, id));
});

export const listMembersHandler = route<GroupParams>(async (c) => {
  const id = await c.id("groupId", "g");
  return ok(listMembers(c.user, id));
});

export const getInviteCodeHandler = route<GroupParams>(async (c) => {
  const id = await c.id("groupId", "g");
  return ok(getInviteCode(c.user, id));
});

export const issueInviteCodeHandler = route<GroupParams>(async (c) => {
  const id = await c.id("groupId", "g");
  return ok(issueInviteCode(c.user, id));
});

export const reissueInviteCodeHandler = route<GroupParams>(async (c) => {
  const id = await c.id("groupId", "g");
  return ok(reissueInviteCode(c.user, id));
});
