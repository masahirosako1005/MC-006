"use client";
import { Badge } from "@mantine/core";

export function MockBadge({ label = "モック" }: { label?: string }) {
  return <Badge color="orange" variant="light" size="sm">{label}</Badge>;
}
