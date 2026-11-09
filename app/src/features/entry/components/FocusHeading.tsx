"use client";

import type { ReactNode } from "react";

export function FocusHeading(props: { children?: ReactNode }) {
  return <h1 tabIndex={-1}>{props.children}</h1>;
}
