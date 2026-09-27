export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--hivis)" />
      <path d="M12.5 11.2 17.6 8h2.6v16h-3.9V13l-3.8 2.3z" fill="var(--hivis-ink)" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={30} />
      <span className="text-[15px] font-semibold tracking-[-0.02em] text-ink">One Login</span>
    </span>
  );
}
