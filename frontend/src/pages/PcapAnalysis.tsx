import { Link } from 'react-router-dom';

const s: Record<string, React.CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', height: '100vh', background: '#0d1117' },
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

// The embedded tool brings its own full header, search and sidebar nav, so this
// page only needs a thin strip to get back to the rest of Fission Ops — it
// deliberately runs without the platform's own sidebar/top bar (see App.tsx's
// FULL_BLEED_PREFIXES) so the tool isn't squeezed between two side navs.
export default function PcapAnalysis() {
  return (
    <div style={s.page}>
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
