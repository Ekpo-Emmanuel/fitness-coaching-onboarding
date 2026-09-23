export function Brand({ compact = false }: { compact?: boolean }) {
  return <span className="brand"><svg className="brand-mark" width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M24 8a11 11 0 1 0 0 16" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/><path d="m17 12 4 4-4 4M12 16h9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>{!compact && <span>coaching<span className="brand-period">.</span></span>}</span>;
}
