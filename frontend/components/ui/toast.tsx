"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";

/* ─── Types ─── */

export type ToastType = "success" | "error" | "info";

export interface ToastData {
  message: string;
  type?: ToastType;
}

/* ─── Hook ─── */

/**
 * Lightweight toast state hook.
 *
 * ```tsx
 * const { toast, showToast, clearToast } = useToast();
 * showToast("Kaydedildi");           // success (default)
 * showToast("Hata olustu", "error"); // error
 * ```
 */
export function useToast(duration = 3000) {
  const [toast, setToast] = useState<ToastData | null>(null);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), duration);
      return () => clearTimeout(t);
    }
  }, [toast, duration]);

  const showToast = useCallback(
    (message: string, type: ToastType = "success") => {
      setToast({ message, type });
    },
    [],
  );

  const clearToast = useCallback(() => setToast(null), []);

  return { toast, showToast, clearToast } as const;
}

/* ─── Styles ─── */

const typeStyles: Record<
  ToastType,
  { bg: string; border: string; text: string; dot: string }
> = {
  success: {
    bg: "bg-[#3DD68C]/10",
    border: "border-[#3DD68C]/20",
    text: "text-[#3DD68C]",
    dot: "bg-[#3DD68C]",
  },
  error: {
    bg: "bg-[#E5484D]/10",
    border: "border-[#E5484D]/20",
    text: "text-[#E5484D]",
    dot: "bg-[#E5484D]",
  },
  info: {
    bg: "bg-[#6C6CFF]/10",
    border: "border-[#6C6CFF]/20",
    text: "text-[#6C6CFF]",
    dot: "bg-[#6C6CFF]",
  },
};

const typeIcons: Record<ToastType, React.ReactNode> = {
  success: (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  info: (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

/* ─── Component ─── */

interface ToastProps {
  toast: ToastData | null;
  /** "top-right" (default) or "bottom-center" */
  position?: "top-right" | "bottom-center";
}

export default function Toast({ toast, position = "top-right" }: ToastProps) {
  const posClass =
    position === "bottom-center"
      ? "fixed bottom-6 left-1/2 -translate-x-1/2"
      : "fixed top-4 right-4";

  const motionProps =
    position === "bottom-center"
      ? { initial: { opacity: 0, y: 20, scale: 0.95 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 20, scale: 0.95 } }
      : { initial: { opacity: 0, y: -20, x: 20 }, animate: { opacity: 1, y: 0, x: 0 }, exit: { opacity: 0, y: -20 } };

  const type = toast?.type ?? "success";
  const s = typeStyles[type];

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          {...motionProps}
          transition={{ duration: 0.2 }}
          role="alert"
          aria-live="polite"
          className={`${posClass} z-50 px-4 py-2.5 ${s.bg} border ${s.border} ${s.text} text-[13px] rounded-lg shadow-lg backdrop-blur-sm flex items-center gap-2`}
        >
          {typeIcons[type]}
          <span>{toast.message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
