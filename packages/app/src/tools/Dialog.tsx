import { type ReactNode, useEffect, useId, useRef } from "react";

// A modal panel for confirmations and small forms. Escape or the backdrop closes it; focus moves inside.
export const Dialog = ({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) => {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  // Callers pass a new onClose on every render; focus moves in on open and back out on close only, so a
  // parent re-rendering (an overview update) never pulls focus away from what someone is typing.
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = panel.current?.querySelector<HTMLElement>("input, select, textarea, button:not(.dialog__close)");
    (first ?? panel.current)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, []);

  return (
    <div className="dialog-backdrop" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        ref={panel}
        className={wide ? "dialog dialog--wide" : "dialog"}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="dialog__header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="tool-button tool-button--quiet tool-button--small dialog__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        {children}
      </div>
    </div>
  );
};

// Yes or no before something that is hard to take back.
export const ConfirmDialog = ({
  title,
  children,
  confirm,
  danger = false,
  onConfirm,
  onClose,
}: {
  title: string;
  children: ReactNode;
  confirm: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) => (
  <Dialog title={title} onClose={onClose}>
    <div className="dialog__body">{children}</div>
    <footer className="dialog__actions">
      <button type="button" className="tool-button" onClick={onClose}>
        Cancel
      </button>
      <button
        type="button"
        className={danger ? "tool-button tool-button--danger" : "tool-button tool-button--primary"}
        onClick={() => {
          onConfirm();
          onClose();
        }}
      >
        {confirm}
      </button>
    </footer>
  </Dialog>
);
