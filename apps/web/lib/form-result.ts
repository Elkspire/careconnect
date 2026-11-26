/**
 * What a server action behind a modal or drawer form returns (see
 * components/ui/overlay.tsx). Returned rather than redirected: a redirect
 * would either leave the dialog open with no message or close it and lose
 * what was typed.
 *
 *   error    the dialog stays open, the message shown at its top
 *   warning  done, but with something to know (e.g. saved, not audited):
 *            the dialog closes and the message stays by its button
 *   success  done: the dialog closes with a short confirmation
 */
export type FormResult = { status: "success" | "warning" | "error"; message: string };
