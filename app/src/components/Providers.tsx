"use client";
import { MantineProvider, createTheme } from "@mantine/core";

const theme = createTheme({ primaryColor: "blue", fontFamily: "var(--mantine-font-family)" });

export function Providers({ children }: { children: React.ReactNode }) {
  return <MantineProvider theme={theme} defaultColorScheme="light">{children}</MantineProvider>;
}
