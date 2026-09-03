import { Colors } from "@/constants/theme";

/**
 * No light/dark branching — see theme.ts's doc comment on why CareConnect
 * is one fixed brand palette, not a system-adaptive theme.
 */
export function useTheme() {
  return Colors;
}
