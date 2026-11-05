import type { Ref } from "react";

/** Point a caller's ref, callback or object, at `value`. */
export function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}
