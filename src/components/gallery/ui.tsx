"use client";

import { useEffect, type ReactNode } from "react";

/** Serif headline with the last word in italics, as in the design. */
export function ItalicTail({ text }: { text: string }) {
  const i = text.trimEnd().lastIndexOf(" ");
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i + 1)}
      <em>{text.slice(i + 1)}</em>
    </>
  );
}

/** "▮▮▮▮▯▯▯▯▯▯ 42%" for progress shown inside a button. */
export function progressBar(p: number) {
  const n = Math.round(Math.max(0, Math.min(1, p)) * 10);
  return `${"▮".repeat(n)}${"▯".repeat(10 - n)} ${Math.round(p * 100)}%`;
}

/** Close on Escape and stop the page scrolling while a layer is open. */
export function useLayer(onClose?: () => void) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
}

/** Bottom sheet on phones, centered card on wider screens. */
export function Sheet({
  label,
  head,
  onClose,
  children,
}: {
  label: string;
  /** Right side of the header row; defaults to a CLOSE button. */
  head?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  useLayer(onClose);
  return (
    <>
      <div className="g-scrim" onClick={onClose} />
      <div className="g-sheet" role="dialog" aria-modal="true" aria-label={label}>
        <div className="g-sheet-head">
          <span>{label}</span>
          {head ?? (
            <button className="g-sheet-close" onClick={onClose}>
              CLOSE ✕
            </button>
          )}
        </div>
        {children}
      </div>
    </>
  );
}
