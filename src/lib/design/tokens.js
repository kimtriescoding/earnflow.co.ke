export const tokens = {
  colors: {
    background: "var(--background)",
    foreground: "var(--foreground)",
    surface: "var(--surface)",
    muted: "var(--muted)",
    brand: "var(--brand)",
    brandStrong: "var(--brand-strong)",
    danger: "var(--danger)",
    success: "var(--success)",
    border: "var(--border)",
  },
  radius: {
    sm: "0.5rem",
    md: "0.75rem",
    lg: "1rem",
    xl: "1.25rem",
    panel: "var(--radius-panel)",
    control: "var(--radius-card)",
  },
  spacing: {
    page: "var(--space-page)",
    section: "var(--space-section)",
  },
  shadows: {
    soft: "var(--shadow-soft)",
    hover: "var(--shadow-hover)",
  },
};

export const cn = (...parts) => parts.filter(Boolean).join(" ");
