import { useSyncExternalStore } from "react";
import { isIosApp } from "@/lib/native";

const subscribe = () => () => {};

/**
 * True only inside the iOS app. The server (and the first hydration render) always say false, then React switches to the real
 * answer, so there is no hydration mismatch. Apple's payment rule (3.1.1): on iOS the app must not show plan prices, buy /
 * upgrade buttons or other ways to pay, so those parts of the page ask this hook.
 */
export function useIsIosApp(): boolean {
  return useSyncExternalStore(subscribe, isIosApp, () => false);
}
