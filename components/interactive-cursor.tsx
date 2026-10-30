"use client";

import { useEffect, useRef, useState } from "react";

export type InteractiveRule = {
  /** CSS selector: a tag ("button"), an id ("#div-with-tap") or a class (".theme-button"). */
  selector: string;
  /** Label shown inside the cursor box while hovering a match, e.g. "click". */
  text: string;
};

export type InteractiveCursorProps = {
  interactiveElements: InteractiveRule[];
};

const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";
const ROOT_ACTIVE_CLASS = "iw-cursor-active";

// Elements where the native caret/I-beam is needed: the custom cursor steps aside.
const NATIVE_CURSOR_SELECTOR =
  'input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]), textarea, select, [contenteditable=""], [contenteditable="true"]';

function findRule(
  target: EventTarget | null,
  rules: InteractiveRule[],
): InteractiveRule | null {
  if (!(target instanceof Element)) return null;
  for (const rule of rules) {
    try {
      if (target.closest(rule.selector)) return rule;
    } catch {
      // Invalid selector: ignore this rule rather than break the cursor.
    }
  }
  return null;
}

export default function InteractiveCursor({
  interactiveElements,
}: InteractiveCursorProps) {
  const [enabled, setEnabled] = useState(false);
  const [label, setLabel] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  const cursorRef = useRef<HTMLDivElement>(null);
  const rulesRef = useRef<InteractiveRule[]>(interactiveElements);

  // Always read the latest rules without re-attaching listeners when the array identity changes.
  useEffect(() => {
    rulesRef.current = interactiveElements;
  }, [interactiveElements]);

  // Desktop / laptop detection (mouse-like primary input). Stays false during SSR and on touch devices.
  useEffect(() => {
    const mql = window.matchMedia(FINE_POINTER_QUERY);
    const update = () => setEnabled(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const root = document.documentElement;
    root.classList.add(ROOT_ACTIVE_CLASS);

    let x = 0;
    let y = 0;
    let frame = 0;

    const paint = () => {
      frame = 0;
      const el = cursorRef.current;
      if (el) el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };

    const onMove = (e: MouseEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
      setVisible(true);
    };

    const onOver = (e: MouseEvent) => {
      if (
        e.target instanceof Element &&
        e.target.closest(NATIVE_CURSOR_SELECTOR)
      ) {
        setVisible(false);
        setLabel(null);
        root.classList.remove(ROOT_ACTIVE_CLASS);
        return;
      }
      root.classList.add(ROOT_ACTIVE_CLASS);
      setVisible(true);
      setLabel(findRule(e.target, rulesRef.current)?.text ?? null);
    };

    const onOut = (e: MouseEvent) => {
      // relatedTarget is null when the pointer leaves the window.
      if (!e.relatedTarget) {
        setVisible(false);
        setLabel(null);
        return;
      }
      // Moving onto a node that matches nothing resets via the following mouseover; clear eagerly
      // only if we are leaving a matching element for a non-matching one.
      if (!findRule(e.relatedTarget, rulesRef.current)) setLabel(null);
    };

    document.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseover", onOver, { passive: true });
    document.addEventListener("mouseout", onOut, { passive: true });

    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      if (frame) cancelAnimationFrame(frame);
      root.classList.remove(ROOT_ACTIVE_CLASS);
    };
  }, [enabled]);

  if (!enabled) return null;

  const isBox = label !== null;

  return (
    <>
      <style>{`html.${ROOT_ACTIVE_CLASS}, html.${ROOT_ACTIVE_CLASS} * { cursor: none !important; }`}</style>
      {/* Outer layer: follows the pointer. Inner layer: centers on it and morphs. */}
      <div
        ref={cursorRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[9999] will-change-transform"
        style={{
          opacity: visible ? 1 : 0,
          transition: "opacity 150ms ease-out",
        }}
      >
        <div
          className={`flex select-none items-center justify-center text-xs font-semibold uppercase leading-none tracking-wide text-white 
            ${isBox ? "bg-black translate-y-1/2 " : "bg-iw-red-1 -translate-x-1/2 -translate-y-1/2 "}`}
          style={{
            minWidth: isBox ? undefined : 16,
            height: isBox ? 28 : 16,
            padding: isBox ? "0 12px" : 0,
            borderRadius: isBox ? 0 : 9999,
            transition:
              "height 150ms ease-out, padding 150ms ease-out, border-radius 150ms ease-out",
            whiteSpace: "nowrap",
          }}
        >
          {isBox ? label : null}
        </div>
      </div>
    </>
  );
}
