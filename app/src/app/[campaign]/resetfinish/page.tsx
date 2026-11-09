"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button, Stack, Text } from "@mantine/core";

export default function ResetFinish() {
  const { campaign: slug } = useParams<{ campaign: string }>();
  return (
    <Stack p="md">
      <Text>リセットが完了しました。</Text>
      <Button component={Link} href={`/${slug}`}>ホームへ</Button>
    </Stack>
  );
}
