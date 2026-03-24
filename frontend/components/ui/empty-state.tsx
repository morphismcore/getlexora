"use client";

import { motion } from "motion/react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } },
};

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={itemVariants} className="relative mb-3">
        {/* Decorative glow ring */}
        <div className="absolute inset-0 -m-3 bg-accent-subtle rounded-full blur-xl animate-glow-pulse opacity-50" />
        <div className="relative">
          {icon ? (
            <div className="text-text-tertiary">{icon}</div>
          ) : (
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-text-tertiary"
            >
              <path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          )}
        </div>
      </motion.div>
      <motion.h3 variants={itemVariants} className="text-[14px] font-medium text-text-secondary">
        {title}
      </motion.h3>
      {description && (
        <motion.p variants={itemVariants} className="mt-1.5 text-[13px] text-text-tertiary max-w-sm">
          {description}
        </motion.p>
      )}
      {action && (
        <motion.button
          variants={itemVariants}
          onClick={action.onClick}
          className="mt-4 px-4 py-2 text-[13px] font-medium text-accent bg-accent-subtle rounded-lg hover:bg-accent-muted transition-colors"
        >
          {action.label}
        </motion.button>
      )}
    </motion.div>
  );
}