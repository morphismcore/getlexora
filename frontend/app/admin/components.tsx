"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";

// ── HeroIcon path shortcut ───────────────────────────

export function HIcon({ d, className = "w-5 h-5" }: { d: string; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

// ── Skeleton Loader ──────────────────────────────────

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-white/[0.06] rounded-lg ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-5 space-y-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-3 w-48" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}

// ── Confirm Dialog ───────────────────────────────────

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Sil",
  confirmColor = "#E5484D",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-[#111113] border border-white/[0.06] rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl"
      >
        <h3 className="text-[15px] font-semibold text-[#ECECEE] mb-2">{title}</h3>
        <p className="text-[13px] text-[#8B8B8E] mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-[12px] font-medium text-[#8B8B8E] hover:text-[#ECECEE] bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors"
          >
            Iptal
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-[12px] font-medium text-white rounded-lg transition-colors"
            style={{ backgroundColor: confirmColor }}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Slide-over Panel ─────────────────────────────────

export function SlideOver({
  open,
  onClose,
  title,
  children,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[50] bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className={`fixed right-0 top-0 bottom-0 z-[51] ${width} w-full bg-[#111113] border-l border-white/[0.06] shadow-2xl flex flex-col`}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <h3 className="text-[15px] font-semibold text-[#ECECEE]">{title}</h3>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/[0.06] text-[#5C5C5F] hover:text-[#ECECEE] transition-colors"
                aria-label="Kapat"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Empty State ──────────────────────────────────────

export function EmptyState({ icon, title, description, action }: { icon: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#111113] border border-white/[0.06] border-dashed rounded-xl p-12 flex flex-col items-center text-center"
    >
      <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center mb-4">
        <HIcon d={icon} className="w-6 h-6 text-[#5C5C5F]" />
      </div>
      <h3 className="text-[14px] font-medium text-[#ECECEE] mb-1">{title}</h3>
      <p className="text-[12px] text-[#5C5C5F] max-w-xs">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  );
}

// ── Form Field wrapper ───────────────────────────────

export function FormField({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="text-[12px] font-medium text-[#8B8B8E] block mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-[#5C5C5F] mt-1">{hint}</p>}
    </div>
  );
}
