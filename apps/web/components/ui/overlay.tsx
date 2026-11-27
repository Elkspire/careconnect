"use client";

import { CheckCircle2, LoaderCircle, TriangleAlert, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import type { FormResult } from "@/lib/form-result";

interface OverlayProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /**
   * Action buttons, pinned under the scrolling content. A Cancel button can
   * be `<form method="dialog"><button>Cancel</button></form>`.
   */
  footer?: ReactNode;
  /**
   * Controlled: pass `open` and `onClose`. Uncontrolled: leave them out and
   * pass `trigger`, the content of the button that opens it — which also
   * makes it usable straight from a server component.
   */
  open?: boolean;
  onClose?: () => void;
  trigger?: ReactNode;
  /** How the trigger button looks. */
  triggerVariant?: keyof typeof TRIGGER;
  /**
   * Makes the body a form posting to this server action, with Cancel and a
   * submit button (`submitLabel`) in the footer. Return a FormResult: an
   * error keeps the dialog open and shows it; anything else closes it.
   */
  formAction?: (formData: FormData) => Promise<FormResult | void>;
  submitLabel?: string;
  /** "danger" for a destructive confirmation (red submit button). */
  submitTone?: "primary" | "danger";
}

const BUTTON = "tap-target inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition";
const TRIGGER = {
  primary: `${BUTTON} bg-primary-700 text-text-on-primary hover:bg-primary-800`,
  secondary: `${BUTTON} border border-border-strong bg-surface text-text hover:bg-surface-muted`,
  danger: `${BUTTON} border border-border-strong bg-surface text-text hover:border-danger-fg hover:text-danger-fg`,
  link: "tap-target inline-flex w-fit items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-800",
} as const;
const SUBMIT = {
  primary: `${BUTTON} bg-primary-700 text-text-on-primary hover:bg-primary-800`,
  danger: `${BUTTON} bg-danger-fg text-surface hover:opacity-90`,
} as const;
const NOTICE = {
  success: { className: "text-success-fg", icon: CheckCircle2 },
  warning: { className: "text-warning-fg", icon: TriangleAlert },
} as const;

function Notice({ result }: { result: FormResult }) {
  const { className, icon: Icon } = NOTICE[result.status === "warning" ? "warning" : "success"];
  return (
    <p role="status" className={`mt-1.5 flex items-start gap-1.5 text-xs font-medium ${className}`}>
      <Icon aria-hidden className="mt-px size-3.5 shrink-0" />
      {result.message}
    </p>
  );
}

/**
 * Shared by Modal and Drawer: a native <dialog> opened with showModal(),
 * which already traps focus, closes on Esc, hides the rest of the page from
 * screen readers and puts focus back on the opener. Added here: page scroll
 * lock, closing on a backdrop click, and the controlled/uncontrolled API.
 */
function Overlay({
  title,
  description,
  children,
  footer,
  open: openProp,
  onClose,
  trigger,
  triggerVariant = "secondary",
  formAction,
  submitLabel,
  submitTone = "primary",
  dialogClassName,
  panelClassName,
}: OverlayProps & { dialogClassName: string; panelClassName: string }) {
  const t = useTranslations("ui");
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [openState, setOpenState] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openState;
  const close = () => (controlled ? onClose?.() : setOpenState(false));
  // The form's error (dialog stays open) and the last outcome shown by the
  // trigger after it closes.
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<FormResult>();

  const [pending, startTransition] = useTransition();

  // onSubmit, not <form action>: React resets a form once its action
  // finishes, which would wipe what was typed when the action says no.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formAction || pending) return;
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await formAction(formData);
      if (result?.status === "error") {
        setError(result.message);
        return;
      }
      setError(undefined);
      setNotice(result ?? undefined);
      close();
    });
  };

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      const root = document.documentElement;
      const previous = root.style.overflow;
      root.style.overflow = "hidden";
      return () => {
        root.style.overflow = previous;
      };
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      {trigger !== undefined && (
        <button
          type="button"
          className={TRIGGER[triggerVariant]}
          onClick={() => {
            setError(undefined);
            setNotice(undefined);
            setOpenState(true);
          }}
        >
          {trigger}
        </button>
      )}
      {notice && <Notice result={notice} />}
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        // Esc: let the parent decide, so a controlled overlay stays in sync.
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        // Closed some other way, e.g. a Cancel button in a <form
        // method="dialog"> (how a server-rendered footer can close it).
        onClose={() => {
          if (open) close();
        }}
        // Clicks on the dialog element itself can only be on the backdrop:
        // the panel inside fills it.
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className={`border-0 bg-transparent p-0 text-text backdrop:bg-[rgb(15_27_45/0.48)] ${dialogClassName}`}
      >
        {open && (
          <div className={`flex flex-col bg-surface shadow-lg ${panelClassName}`}>
            <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
              <div className="min-w-0">
                <h2 id={titleId} className="text-base font-bold text-text">
                  {title}
                </h2>
                {description && (
                  <div id={descriptionId} className="mt-1 text-sm text-text-muted">
                    {description}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={close}
                aria-label={t("close")}
                className="tap-target -me-2 -mt-2 inline-flex shrink-0 items-center justify-center rounded-md text-text-muted transition hover:bg-surface-muted hover:text-text"
              >
                <X aria-hidden className="size-5" />
              </button>
            </div>
            {formAction ? (
              <form onSubmit={submit} aria-busy={pending || undefined} className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
                  {error && (
                    <p
                      role="alert"
                      className="mb-4 flex items-start gap-2 rounded-md bg-danger-bg px-3 py-2.5 text-sm font-medium text-danger-fg"
                    >
                      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                      {error}
                    </p>
                  )}
                  {children}
                </div>
                <div className="flex flex-wrap justify-end gap-2 border-t border-border px-6 py-4">
                  {footer}
                  <button type="button" onClick={close} className={TRIGGER.secondary}>
                    {t("cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className={`${SUBMIT[submitTone]} disabled:cursor-wait disabled:opacity-80`}
                  >
                    {pending && <LoaderCircle aria-hidden className="size-4 shrink-0 animate-spin" />}
                    {submitLabel}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>
                {footer && (
                  <div className="flex flex-wrap justify-end gap-2 border-t border-border px-6 py-4">
                    {footer}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}

/** A centred dialog for a short task: a form, a confirmation, a summary. */
export function Modal({ size = "md", ...props }: OverlayProps & { size?: "md" | "lg" }) {
  return (
    <Overlay
      {...props}
      dialogClassName={`m-auto w-[calc(100%-2rem)] ${size === "lg" ? "max-w-[660px]" : "max-w-[580px]"}`}
      panelClassName="max-h-[90dvh] rounded-xl [animation:modal-in_0.18s_ease-out]"
    />
  );
}

/**
 * A panel sliding in from the inline end (right, or left in Urdu) for
 * detail that keeps the list behind it in place: a patient, an order.
 */
export function Drawer(props: OverlayProps) {
  return (
    <Overlay
      {...props}
      dialogClassName="m-0 ms-auto h-dvh max-h-none w-full max-w-[640px]"
      panelClassName="h-full shadow-[-20px_0_50px_rgb(15_27_45/0.2)] [animation:drawer-in_0.22s_ease-out] rtl:[animation-name:drawer-in-rtl] rtl:shadow-[20px_0_50px_rgb(15_27_45/0.2)]"
    />
  );
}
