import { Badge, type BadgeTone } from "./badge";

/**
 * One colour per status, so the same state looks the same everywhere: teal
 * for "in progress here", green for done or good, amber for "needs someone",
 * red for failed or refused, grey for over. Follows the prototypes' queue
 * (Checked in = teal, Waiting = amber, Done = grey).
 */
const TONES = {
  appointment: {
    booked: "blue",
    checked_in: "teal",
    completed: "gray",
    cancelled: "gray",
    no_show: "red",
  },
  waitlist: {
    waiting: "orange",
    offered: "teal",
    converted: "green",
    expired: "gray",
    cancelled: "gray",
  },
  verification: { unverified: "gray", pending: "orange", verified: "green" },
  staff: { invited: "orange", active: "green", revoked: "gray" },
  notification: { queued: "gray", sent: "blue", delivered: "green", failed: "red" },
  share: { active: "green", expired: "gray", revoked: "gray" },
} as const satisfies Record<string, Record<string, BadgeTone>>;

export type StatusKind = keyof typeof TONES;

/** A status the table doesn't know shows grey rather than failing. */
export function statusTone(kind: StatusKind, status: string): BadgeTone {
  return (TONES[kind] as Record<string, BadgeTone>)[status] ?? "gray";
}

/**
 * A status pill with the colour for that status. The label stays the
 * caller's, already translated (e.g. t(`status.${appt.status}`)).
 */
export function StatusBadge({
  kind,
  status,
  label,
}: {
  kind: StatusKind;
  /** e.g. "checked_in". Typed as string because the API's types are. */
  status: string;
  label: string;
}) {
  return (
    <Badge tone={statusTone(kind, status)} dot>
      {label}
    </Badge>
  );
}
