// Crop only the display viewport around the existing official artwork.
// The source PNG, proportions, colours and paths remain unchanged.
export function BrandLogo({ name = 'رَوْنَق', compact = false }: { name?: string; compact?: boolean }) {
  return <span className="brand-logo" style={{ display: 'inline-flex', alignItems: 'center', gap: compact ? 10 : 12, flexShrink: 0, lineHeight: 1 }}>
    <svg aria-hidden="true" focusable="false" viewBox="155 105 190 290" width={compact ? 27 : 31} height={compact ? 40 : 46} style={{ display: 'block', flexShrink: 0 }}>
      <image href="/logo-icon.png" width="501" height="501" />
    </svg>
    <span style={{ fontSize: compact ? 22 : 'clamp(24px, 4vw, 27px)', fontWeight: 900, color: 'inherit', whiteSpace: 'nowrap', paddingTop: 4 }}>{name}</span>
  </span>
}
