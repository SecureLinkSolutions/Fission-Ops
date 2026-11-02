const s: Record<string, React.CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)', background: '#0d1117' },
  header: { padding: '16px 32px', borderBottom: '1px solid #30363d', flexShrink: 0 },
  heading: { fontSize: '20px', fontWeight: 700, color: '#e6edf3', marginBottom: '4px' },
  sub: { fontSize: '13px', color: '#8b949e' },
  frame: { flex: 1, border: 'none', width: '100%' },
};

export default function PcapAnalysis() {
  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.heading}>PCAP Analysis</div>
        <div style={s.sub}>Capture analysis, parsed entirely in your browser — nothing is uploaded.</div>
      </div>
      <iframe
        src="/tools/pcap-analysis.html"
        title="PCAP Analysis"
        style={s.frame}
      />
    </div>
  );
}
