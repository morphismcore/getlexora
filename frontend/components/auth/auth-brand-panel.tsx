"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "motion/react";

/* ─── Floating icon SVGs ─── */
const FloatingIconSvg = ({ index }: { index: number }) => {
  switch (index) {
    case 0: // Scales of justice
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-full h-full">
          <path d="M12 3v18M3 7l3 7c0 1.66 1.34 2 3 2s3-.34 3-2l3-7M15 7l3 7c0 1.66 1.34 2 3 2s3-.34 3-2l3-7" />
          <circle cx="12" cy="3" r="1" />
        </svg>
      );
    case 1: // Book
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-full h-full">
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20M4 4.5A2.5 2.5 0 016.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15z" />
        </svg>
      );
    case 2: // Shield
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-full h-full">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case 3: // Gavel
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-full h-full">
          <path d="M14.5 2l5 5-5 5-5-5 5-5zM3 21l6-6M2 22l1-1" />
          <rect x="8" y="8" width="8" height="2" rx="1" transform="rotate(45 12 9)" />
        </svg>
      );
    case 4: // Paragraph
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-full h-full">
          <path d="M13 4v16M17 4v16M13 4h4a4 4 0 010 8h-4" />
        </svg>
      );
    case 5: // Pillar
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-full h-full">
          <path d="M6 2h12l-2 4H8L6 2zM8 6v12M16 6v12M6 18h12l2 4H4l2-4z" />
        </svg>
      );
    default:
      return null;
  }
};

const FLOATING_ICONS = [
  { x: 15, y: 20, size: 40, delay: 0 },
  { x: 75, y: 60, size: 36, delay: 0.5 },
  { x: 30, y: 70, size: 32, delay: 1 },
  { x: 65, y: 25, size: 34, delay: 1.5 },
  { x: 50, y: 85, size: 28, delay: 2 },
  { x: 85, y: 80, size: 30, delay: 0.8 },
];

const TYPEWRITER_TEXT = "Hukuk Arastirma Asistani";

export function AuthBrandPanel() {
  const [typewriterIndex, setTypewriterIndex] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const leftPanelRef = useRef<HTMLDivElement>(null);

  // Typewriter effect
  useEffect(() => {
    if (typewriterIndex < TYPEWRITER_TEXT.length) {
      const timer = setTimeout(() => setTypewriterIndex((i) => i + 1), 60);
      return () => clearTimeout(timer);
    }
  }, [typewriterIndex]);

  // Mouse tracking for parallax
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!leftPanelRef.current) return;
    const rect = leftPanelRef.current.getBoundingClientRect();
    setMousePos({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  }, []);

  return (
    <div
      ref={leftPanelRef}
      onMouseMove={handleMouseMove}
      className="relative w-full md:w-[55%] min-h-[280px] md:min-h-screen overflow-hidden flex items-center justify-center"
    >
      {/* Gradient mesh background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#6C6CFF]/20 via-[#09090B] to-[#A78BFA]/10" />
        <div
          className="absolute w-[600px] h-[600px] rounded-full blur-[120px] opacity-20"
          style={{
            background: "radial-gradient(circle, #6C6CFF 0%, transparent 70%)",
            left: `${mousePos.x * 30}%`,
            top: `${mousePos.y * 30}%`,
            transition: "left 0.8s ease-out, top 0.8s ease-out",
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full blur-[100px] opacity-15"
          style={{
            background: "radial-gradient(circle, #A78BFA 0%, transparent 70%)",
            right: `${(1 - mousePos.x) * 20}%`,
            bottom: `${(1 - mousePos.y) * 20}%`,
            transition: "right 1s ease-out, bottom 1s ease-out",
          }}
        />
      </div>

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Floating icons */}
      <div className="absolute inset-0 hidden md:block">
        {FLOATING_ICONS.map((icon, i) => (
          <motion.div
            key={i}
            className="absolute text-[#6C6CFF]/20"
            style={{
              left: `${icon.x}%`,
              top: `${icon.y}%`,
              width: icon.size,
              height: icon.size,
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: 1,
              scale: 1,
              x: (mousePos.x - 0.5) * (15 + i * 5),
              y: (mousePos.y - 0.5) * (15 + i * 5),
            }}
            transition={{
              opacity: { delay: icon.delay, duration: 0.8 },
              scale: { delay: icon.delay, duration: 0.8 },
              x: { duration: 1.2, ease: "easeOut" },
              y: { duration: 1.2, ease: "easeOut" },
            }}
          >
            <FloatingIconSvg index={i} />
          </motion.div>
        ))}
      </div>

      {/* Center content */}
      <div className="relative z-10 text-center px-8">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="mb-6"
        >
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-[#6C6CFF] to-[#A78BFA] flex items-center justify-center glow-accent">
            <span className="text-white text-3xl font-bold">L</span>
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="text-4xl md:text-5xl font-bold tracking-tight"
        >
          <span className="gradient-text">Lexora</span>
        </motion.h1>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-3 h-6"
        >
          <span className="text-[16px] text-[#8B8B8E] font-[family-name:var(--font-serif)]">
            {TYPEWRITER_TEXT.slice(0, typewriterIndex)}
            <span className="animate-pulse text-[#6C6CFF]">|</span>
          </span>
        </motion.div>

        {/* Trust indicators */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="mt-10 hidden md:flex items-center justify-center gap-8"
        >
          {[
            { value: "500+", label: "Avukat" },
            { value: "1M+", label: "Karar" },
            { value: "50+", label: "Baro" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-[20px] font-bold text-[#ECECEE]">{stat.value}</p>
              <p className="text-[11px] text-[#5C5C5F] mt-0.5">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
