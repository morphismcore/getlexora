interface BadgeProps {
  variant: "verified" | "not_found" | "partial" | "info" | "neutral";
  size?: "sm" | "md";
  children: React.ReactNode;
}

const variantStyles: Record<BadgeProps["variant"], string> = {
  verified: "bg-success-subtle text-success",
  not_found: "bg-destructive-subtle text-destructive",
  partial: "bg-warning-subtle text-warning",
  info: "bg-accent-subtle text-accent",
  neutral: "bg-[rgba(255,255,255,0.06)] text-text-tertiary",
};

const sizeStyles: Record<NonNullable<BadgeProps["size"]>, string> = {
  sm: "px-2 py-0.5 text-[11px]",
  md: "px-2.5 py-0.5 text-[11px]",
};

export default function Badge({ variant, size = "md", children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${variantStyles[variant]} ${sizeStyles[size]}`}
    >
      {children}
    </span>
  );
}
