"use client";

import { useStore } from "zustand";
import { appStore, type AppStore } from "./app-store";

export function useAppStore<Selected>(
  selector: (state: AppStore) => Selected,
): Selected {
  return useStore(appStore, selector);
}
