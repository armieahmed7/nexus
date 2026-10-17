import { useEffect, useRef, type RefObject } from 'react';

/**
 * Header popovers (public nav dropdowns, account menu, backend chip): while open, Escape closes and returns focus to the
 * trigger; a pointer press or focus landing outside `root` closes without moving focus.
 */
export function useDismiss(open: boolean, close: () => void, root: RefObject<HTMLElement>, trigger: RefObject<HTMLElement>) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const outside = (n: EventTarget | null) => !!root.current && n instanceof Node && !root.current.contains(n);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      closeRef.current();
      trigger.current?.focus();
    };
    const onPointer = (e: PointerEvent) => outside(e.target) && closeRef.current();
    const onFocus = (e: FocusEvent) => outside(e.target) && closeRef.current();
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('focusin', onFocus);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('focusin', onFocus);
    };
  }, [open, root, trigger]);
}
