"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

interface TooltipState {
  text: string;
  x: number;
  y: number;
  anchorBottom: number;
}

export default function TooltipProvider() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    above: boolean;
  } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const activeTarget = useRef<Element | null>(null);

  const show = useCallback((target: Element) => {
    const text = target.getAttribute("data-tooltip");
    if (!text) return;
    activeTarget.current = target;
    const rect = target.getBoundingClientRect();
    setTooltip({
      text,
      x: rect.left + rect.width / 2,
      y: rect.top,
      anchorBottom: rect.bottom,
    });
  }, []);

  const hide = useCallback(() => {
    activeTarget.current = null;
    setTooltip(null);
    setPosition(null);
  }, []);

  // Measure tooltip after render to detect edge collisions
  useEffect(() => {
    if (!tooltip || !tooltipRef.current) return;
    const el = tooltipRef.current;
    const rect = el.getBoundingClientRect();
    const pad = 8;

    let above = true;
    let top = tooltip.y - pad;
    // If tooltip would go above viewport, show below instead
    if (top - rect.height < pad) {
      above = false;
      top = tooltip.anchorBottom + pad;
    }

    // Clamp horizontally to stay in viewport
    let left = tooltip.x;
    const halfW = rect.width / 2;
    if (left - halfW < pad) left = halfW + pad;
    if (left + halfW > window.innerWidth - pad)
      left = window.innerWidth - pad - halfW;

    setPosition({ left, top, above });
  }, [tooltip]);

  useEffect(() => {
    function handleEnter(e: Event) {
      const target = (e.target as HTMLElement).closest("[data-tooltip]");
      if (target) show(target);
    }

    function handleLeave(e: Event) {
      const target = (e.target as HTMLElement).closest("[data-tooltip]");
      if (target && target === activeTarget.current) hide();
    }

    document.addEventListener("mouseenter", handleEnter, true);
    document.addEventListener("mouseleave", handleLeave, true);
    document.addEventListener("touchstart", hide, true);
    return () => {
      document.removeEventListener("mouseenter", handleEnter, true);
      document.removeEventListener("mouseleave", handleLeave, true);
      document.removeEventListener("touchstart", hide, true);
    };
  }, [show, hide]);

  if (!tooltip) return null;

  return createPortal(
    <div
      ref={tooltipRef}
      className="tooltip-portal"
      style={{
        position: "fixed",
        left: position?.left ?? tooltip.x,
        top: position
          ? position.above
            ? position.top
            : position.top
          : tooltip.y - 8,
        transform: position?.above !== false
          ? "translate(-50%, -100%)"
          : "translate(-50%, 0)",
        opacity: position ? 1 : 0,
      }}
    >
      {tooltip.text}
    </div>,
    document.body
  );
}
