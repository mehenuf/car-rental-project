"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";
import { useLocalePath } from "./provider";

/** `next/link` that keeps the visitor in their language. Drop-in replacement inside `[lang]` pages. */
export function Link({ href, ...props }: ComponentProps<typeof NextLink>) {
  const localePath = useLocalePath();
  return <NextLink href={typeof href === "string" ? localePath(href) : href} {...props} />;
}
