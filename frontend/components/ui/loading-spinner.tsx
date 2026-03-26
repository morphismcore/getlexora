interface LoadingSpinnerProps {
  /** Tailwind size class (default: "w-4 h-4") */
  size?: "xs" | "sm" | "md" | "lg";
  /** Color variant (default: "white") */
  variant?: "white" | "accent" | "current";
  className?: string;
}

const sizeMap = {
  xs: "w-3.5 h-3.5",
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
} as const;

const variantMap = {
  white: "border-white/30 border-t-white",
  accent: "border-[#6C6CFF]/30 border-t-[#6C6CFF]",
  current: "border-current/30 border-t-current",
} as const;

export default function LoadingSpinner({
  size = "sm",
  variant = "white",
  className = "",
}: LoadingSpinnerProps) {
  return (
    <div
      className={`${sizeMap[size]} border-2 ${variantMap[variant]} rounded-full animate-spin ${className}`}
      role="status"
      aria-label="Yükleniyor"
    >
      <span className="sr-only">Yükleniyor...</span>
    </div>
  );
}
