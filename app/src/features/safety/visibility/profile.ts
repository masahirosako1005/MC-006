// 09: プロフィールの公開範囲。スタブ(P-2-2)。
import type { DemoUser, Id } from "@/lib/groups-types";
import type { MyProfileDto, Profile, ProfileContext, ProfileInput, ProfileRelation, PublicProfile } from "../types";

export function maskProfile(profile: Profile, relation: ProfileRelation): PublicProfile {
  void profile; void relation;
  throw new Error("not implemented");
}

export function resolveProfileRelation(viewerId: Id, targetId: Id, ctx: ProfileContext): ProfileRelation {
  void viewerId; void targetId; void ctx;
  throw new Error("not implemented");
}

export function visibleProfile(viewer: { id: Id }, targetId: Id, ctx: ProfileContext): PublicProfile {
  void viewer; void targetId; void ctx;
  throw new Error("not implemented");
}

export function getMyProfile(user: Readonly<DemoUser>): MyProfileDto {
  void user;
  throw new Error("not implemented");
}

export function updateProfile(user: Readonly<DemoUser>, input: ProfileInput): MyProfileDto {
  void user; void input;
  throw new Error("not implemented");
}
