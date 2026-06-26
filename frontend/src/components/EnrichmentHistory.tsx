import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';

interface EnrichmentHistoryEntry {
  id: string;
  entity_id: string;
  source: string;
  triggered_by?: string;
  triggered_by_name?: string;
  verdict?: string;
  raw_result?: Record<string, unknown>;
  summary?: string;
  created_at: string;
}

interface Props {
  entityId: string;
  triggeredBy?: string;
}

const SOURCE_COLORS: Record<string, string> = {
  virustotal: '#a371f7',
  abuseipdb: '#f85149',
  shodan: '#58a6ff',
  manual: '#e3a517',
};

const VERDICT_COLORS: Record<string, string> = {
  malicious: '#f85149',
  suspicious: '#d29922',
  clean: '#3fb950',
  unknown: '#8b949e',
};

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function formatAbsoluteTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

export default function EnrichmentHistory({ entityId }: Props) {
  const [history, setHistory] = useState<EnrichmentHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [expandedRaw, setExpandedRaw] = useState<Set<string>>(new Set());

  const fetchHistory = useCallback(async () => {
    try {
      const res = await apiClient.get(`/entities/${entityId}/enrichment-history`);
      setHistory(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  async function handleRunEnrichment() {
    setRunning(true);
    try {
      await apiClient.post(`/entities/${entityId}/enrich`);
      await fetchHistory();
    } catch {
      // ignore
    } finally {
      setRunning(false);
    }
  }

  function toggleRaw(id: string) {
    setExpandedRaw((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Build a map of verdict changes per source (history is newest-first, reverse for chronological)
  const chronological = [...history].reverse();
  const verdictChanges = new Set<string>();
  const lastVerdictBySource: Record<string, string | undefined> = {};
  for (const entry of chronological) {
    const prev = lastVerdictBySource[entry.source];
    if (prev !== undefined && entry.verdict && prev !== entry.verdict) {
      verdictChanges.add(entry.id);
    }
    lastVerdictBySource[entry.source] = entry.verdict;
  }

  return (
    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ fontWeight: 600, fontSize: '11px', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Enrichment History</div>
        <button type="button"
          onClick={handleRunEnrichment}
          disabled={running}
          style={{
            background: running ? '#21262d' : '#238636',
            border: `1px solid ${running ? '#30363d' : '#2ea043'}`,
            borderRadius: '6px',
            padding: '6px 14px',
            color: running ? '#8b949e' : '#ffffff',
            fontSize: '13px',
            fontWeight: 600,
            cursor: running ? 'not-allowed' : 'pointer',
          }}
        >
          {running ? 'Running…' : 'Run Enrichment'}
        </button>
      </div>

      {loading && <div style={{ color: '#8b949e', fontSize: '13px' }}>Loading history…</div>}

      {!loading && history.length === 0 && (
        <div style={{ color: '#8b949e', fontSize: '13px', textAlign: 'center', padding: '32px 0' }}>
          No enrichment history yet. Click Run Enrichment to fetch threat intelligence.
        </div>
      )}

      {!loading && history.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {history.map((entry) => {
            const sourceColor = SOURCE_COLORS[entry.source] ?? '#8b949e';
            const verdictColor = entry.verdict ? (VERDICT_COLORS[entry.verdict] ?? '#8b949e') : '#8b949e';
            const isExpanded = expandedRaw.has(entry.id);
            const hasChange = verdictChanges.has(entry.id);

            return (
              <div key={entry.id}>
                {hasChange && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: '#d2992222', border: '1px solid #d2992244', borderRadius: '4px', marginBottom: '4px' }}>
                    <span style={{ color: '#d29922', fontSize: '12px', fontWeight: 600 }}>⚠ Verdict changed</span>
                  </div>
                )}
                <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                    <span style={{ background: `${sourceColor}22`, color: sourceColor, border: `1px solid ${sourceColor}44`, borderRadius: '4px', padding: '2px 8px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                      {entry.source}
                    </span>
                    {entry.verdict ? (
                      <span style={{ background: `${verdictColor}22`, color: verdictColor, border: `1px solid ${verdictColor}44`, borderRadius: '4px', padding: '2px 8px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                        {entry.verdict}
                      </span>
                    ) : (
                      <span style={{ background: '#8b949e22', color: '#8b949e', border: '1px solid #8b949e44', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', fontWeight: 700 }}>
                        NO VERDICT
                      </span>
                    )}
                    <span
                      title={formatAbsoluteTime(entry.created_at)}
                      style={{ color: '#8b949e', fontSize: '12px', marginLeft: 'auto', cursor: 'default' }}
                    >
                      {formatRelativeTime(entry.created_at)}
                    </span>
                  </div>

                  {entry.summary && (
                    <div style={{ color: '#e6edf3', fontSize: '13px', marginBottom: '6px' }}>{entry.summary}</div>
                  )}

                  <div style={{ color: '#8b949e', fontSize: '11px', marginBottom: entry.raw_result ? '8px' : '0' }}>
                    {entry.triggered_by_name ? `triggered by ${entry.triggered_by_name}` : 'triggered by system'}
                  </div>

                  {entry.raw_result && (
                    <div>
                      <button type="button"
                        onClick={() => toggleRaw(entry.id)}
                        style={{ background: 'none', border: 'none', color: '#58a6ff', fontSize: '12px', cursor: 'pointer', padding: '0' }}
                      >
                        {isExpanded ? 'Hide raw' : 'Show raw'}
                      </button>
                      {isExpanded && (
                        <pre style={{ background: '#010409', border: '1px solid #30363d', borderRadius: '4px', padding: '10px', fontSize: '11px', color: '#e6edf3', overflow: 'auto', maxHeight: '300px', marginTop: '8px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                          {JSON.stringify(entry.raw_result, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
