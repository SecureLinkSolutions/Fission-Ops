import { Link } from 'react-router-dom';

const s: Record<string, React.CSSProperties> = {
  wrap: { position: 'fixed', inset: 0, zIndex: 150, flexDirection: 'column', background: '#0d1117' },
  header: {
    padding: '8px 16px', borderBottom: '1px solid #30363d', flexShrink: 0,
    display: 'flex', alignItems: 'center', gap: '12px', background: '#161b22',
  },
  back: {
    display: 'flex', alignItems: 'center', gap: '6px', color: '#8b949e', textDecoration: 'none',
    fontSize: '12px', fontWeight: 600, padding: '4px 8px', borderRadius: '6px', flexShrink: 0,
  },
  sub: { fontSize: '12px', color: '#6e7681' },
  frame: { flex: 1, border: 'none', width: '100%' },
};

// Mounted once, for good, in App.tsx — not inside <Routes>. The embedded tool
// parses capture files entirely in its own iframe's memory; if this lived
// inside the routed PcapAnalysis page, navigating away would unmount the
// iframe and wipe whatever the analyst had loaded. Visibility is toggled
// with plain CSS instead, so a capture stays loaded while an analyst hops
// back to the rest of Fission Ops to log an entity, then returns to it.
export default function PcapAnalysisFrame({ visible }: { visible: boolean }) {
  return (
    <div style={{ ...s.wrap, display: visible ? 'flex' : 'none' }}>
      <div style={s.header}>
        <Link
          to="/incidents"
          style={s.back}
          onMouseOver={(e) => { e.currentTarget.style.color = '#e6edf3'; e.currentTarget.style.background = '#21262d'; }}
          onMouseOut={(e) => { e.currentTarget.style.color = '#8b949e'; e.currentTarget.style.background = 'transparent'; }}
        >
          ← Fission<span style={{ color: '#f97316' }}>Ops</span>
        </Link>
        <span style={s.sub}>Capture analysis, parsed entirely in your browser — nothing is uploaded.</span>
      </div>
      <iframe
        src="/tools/pcap-analysis.html"
        title="PCAP Analysis"
        style={s.frame}
      />
    </div>
  );
}
