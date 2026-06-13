import type { OnboardingStepState } from "@/lib/types";

/** API may return step_states as array or keyed object — normalize for array methods. */
export function normalizeStepStates(
  raw: OnboardingStepState[] | Record<string, OnboardingStepState> | undefined | null,
): OnboardingStepState[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return Object.values(raw).sort((a, b) => a.step - b.step);
}
