"use client";

import { createContext, useContext } from "react";

/** True while the workspace is waiting for approval (see lib/read-only.ts). */
export const ReadOnlyContext = createContext(false);

export function useReadOnly(): boolean {
  return useContext(ReadOnlyContext);
}
