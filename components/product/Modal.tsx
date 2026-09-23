"use client";
import { useEffect, useRef, type ReactNode } from "react";

export function Modal({ children, titleId, onClose }: { children: ReactNode; titleId: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} className="native-modal" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose(); }}><div className="modal-panel">{children}</div></dialog>;
}
