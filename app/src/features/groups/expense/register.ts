// 07 のイベント購読の登録(EXP-FN-08)。bootstrap.ts から import される。
import { on } from "@/lib/events";
import { onGroupMemberLeft } from "./service";

on("member_left", "expense", onGroupMemberLeft);
