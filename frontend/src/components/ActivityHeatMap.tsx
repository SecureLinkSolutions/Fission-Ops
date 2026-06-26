import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { apiClient } from '../api/client';
import { TimelineEntry } from '../types';
import { relativeTime } from '../utils/time';

interface Props {
  incidentId: string;
}

type TypeKey =
  | 'ENTITY_CREATED'
  | 'KILL_CHAIN_MAPPED'
  | 'TTP_ASSIGNED'
  | 'RELATIONSHIP_CREATED'
  | 'IOC_FLAGGED'
  | 'STATUS_CHANGED'
  | 'OTHER';

interface Bucket {
  bucket_start: string;
  count: number;
  by_type: Record<TypeKey, number>;
}

interface HeatmapData {
  bucket_size: 'hour' | '6hour' | 'day';
  incident_start: string;
  incident_end: string;
  buckets: Bucket[];
  type_totals: Record<TypeKey, number>;
}

const TYPE_COLORS: Record<TypeKey, string> = {
  ENTITY_CREATED: '#3fb950',
  KILL_CHAIN_MAPPED: '#58a6ff',
  TTP_ASSIGNED: '#a371f7',
  RELATIONSHIP_CREATED: '#d29922',
  IOC_FLAGGED: '#f85149',
  STATUS_CHANGED: '#f0883e',
  OTHER: '#8b949e',
};

const TYPE_LABELS: Record<TypeKey, string> = {
  ENTITY_CREATED: 'Entity Created',
  KILL_CHAIN_MAPPED: 'Kill Chain',
  TTP_ASSIGNED: 'TTP Assigned',
  RELATIONSHIP_CREATED: 'Relationship',
  IOC_FLAGGED: 'IOC Flagged',
  STATUS_CHANGED: 'Status Changed',
  OTHER: 'Other',
};

const TYPE_KEYS: TypeKey[] = [
  'ENTITY_CREATED',
  'KILL_CHAIN_MAPPED',
  'TTP_ASSIGNED',
  'RELATIONSHIP_CREATED',
  'IOC_FLAGGED',
  'STATUS_CHANGED',
  'OTHER',
];

function getCellColor(count: number, maxCount: number): string {
  if (count === 0 || maxCount === 0) return '#161b22';
  const ratio = count / maxCount;
  if (ratio <= 0.25) return '#1a3a2a';
  if (ratio <= 0.5) return '#1f6b3a';
  if (ratio <= 0.75) return '#2ea043';
  return '#3fb950';
}

function getCellHoverColor(count: number, maxCount: number): string {
  if (count === 0 || maxCount === 0) return '#1c2128';
  const ratio = count / maxCount;
  if (ratio <= 0.25) return '#204830';
  if (ratio <= 0.5) return '#257a44';
  if (ratio <= 0.75) return '#35b54c';
  return '#4bcc5e';
}

function formatBucketLabel(ts: string, bucketSize: 'hour' | '6hour' | 'day'): string {
  const d = new Date(ts);
  if (bucketSize === 'hour') {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (bucketSize === '6hour') {
    return (
      d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
      ' ' +
      d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatBucketRange(ts: string, bucketSize: 'hour' | '6hour' | 'day'): string {
  const start = new Date(ts);
  const end = new Date(start);
  if (bucketSize === 'hour') end.setHours(end.getHours() + 1);
  else if (bucketSize === '6hour') end.setHours(end.getHours() + 6);
  else end.setDate(end.getDate() + 1);
  return `${start.toLocaleString()} – ${end.toLocaleTimeString()}`;
}

function getBucketEnd(ts: string, bucketSize: 'hour' | '6hour' | 'day'): string {
  const start = new Date(ts);
  if (bucketSize === 'hour') start.setHours(start.getHours() + 1);
  else if (bucketSize === '6hour') start.setHours(start.getHours() + 6);
  else start.setDate(start.getDate() + 1);
  return start.toISOString();
}

const ACTION_TYPE_COLORS: Record<string, string> = {
  ENTITY_CREATED: '#3fb950',
  KILL_CHAIN_MAPPED: '#58a6ff',
  TTP_ASSIGNED: '#a371f7',
  RELATIONSHIP_CREATED: '#d29922',
  BOUNDARY_TRAVERSAL: '#f0883e',
};

export default function ActivityHeatMap({ incidentId }: Props) {
  const [selectedBucket, setSelectedBucket] = useState<Bucket | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const { data: heatmap, loading, error } = useFetch<HeatmapData>(
    () => apiClient.get(`/incidents/${incidentId}/activity-heatmap`).then((r) => r.data),
    [incidentId],
  );

  const { data: fullTimeline } = useFetch<TimelineEntry[]>(
    () => apiClient.get(`/incidents/${incidentId}/timeline`).then((r) => r.data),
    [incidentId],
  );

  if (loading) {
    return <div style={{ color: '#6e7681', fontSize: '13px', padding: '16px 0' }}>Loading heat map…</div>;
  }
  if (error || !heatmap) {
    return (
      <div style={{ color: '#f85149', fontSize: '13px', padding: '16px 0' }}>
        Failed to load activity heat map.
      </div>
    );
  }

  const maxCount = Math.max(...heatmap.buckets.map((b) => b.count), 1);
  const numBuckets = heatmap.buckets.length;
  const labelEvery = numBuckets <= 20 ? 1 : numBuckets <= 40 ? 2 : 4;

  const bucketEvents: TimelineEntry[] =
    selectedBucket && fullTimeline
      ? fullTimeline.filter((e) => {
          const ts = new Date(e.ts).getTime();
          const start = new Date(selectedBucket.bucket_start).getTime();
          const end = new Date(getBucketEnd(selectedBucket.bucket_start, heatmap.bucket_size)).getTime();
          return ts >= start && ts < end;
        })
      : [];

  return (
    <div style={{ marginBottom: '24px' }}>
      {/* Summary pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
        {TYPE_KEYS.filter((k) => heatmap.type_totals[k] > 0).map((k) => (
          <span
            key={k}
            style={{
              background: `${TYPE_COLORS[k]}22`,
              color: TYPE_COLORS[k],
              border: `1px solid ${TYPE_COLORS[k]}44`,
              borderRadius: '20px',
              padding: '3px 10px',
              fontSize: '11px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: TYPE_COLORS[k],
                display: 'inline-block',
              }}
            />
            {heatmap.type_totals[k]} {TYPE_LABELS[k]}
          </span>
        ))}
      </div>

      {/* Heat map panel */}
      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '16px' }}>
        <div style={{ fontWeight: 600, fontSize: '14px', color: '#e6edf3', marginBottom: '12px' }}>
          Activity Heat Map
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
          {TYPE_KEYS.map((k) => (
            <span key={k} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#8b949e' }}>
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  background: TYPE_COLORS[k],
                  borderRadius: '2px',
                  display: 'inline-block',
                }}
              />
              {TYPE_LABELS[k]}
            </span>
          ))}
        </div>

        {/* Scrollable cells + labels */}
        <div style={{ overflowX: 'auto', paddingBottom: '8px' }}>
          {/* Cells row */}
          <div style={{ display: 'flex', gap: '2px', minWidth: 'max-content' }}>
            {heatmap.buckets.map((bucket, i) => {
              const isSelected = selectedBucket?.bucket_start === bucket.bucket_start;
              const isHovered = hoveredIndex === i;
              const bg = isHovered
                ? getCellHoverColor(bucket.count, maxCount)
                : getCellColor(bucket.count, maxCount);

              return (
                <div
                  key={bucket.bucket_start}
                  style={{
                    position: 'relative',
                    flex: '1 1 0',
                    minWidth: '40px',
                    maxWidth: '80px',
                    height: '60px',
                    background: bg,
                    border: isSelected ? '2px solid #f97316' : '2px solid transparent',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.1s',
                    overflow: 'hidden',
                  }}
                  onClick={() => setSelectedBucket(isSelected ? null : bucket)}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  title={`${formatBucketLabel(bucket.bucket_start, heatmap.bucket_size)}: ${bucket.count} events`}
                >
                  {bucket.count > 0 && (
                    <span style={{ color: '#fff', fontSize: '11px', fontWeight: 700, lineHeight: 1 }}>
                      {bucket.count}
                    </span>
                  )}

                  {/* Stacked type bar at bottom */}
                  {bucket.count > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: '4px',
                        display: 'flex',
                        overflow: 'hidden',
                      }}
                    >
                      {TYPE_KEYS.map((k) => {
                        const val = bucket.by_type[k];
                        if (val === 0) return null;
                        const pct = (val / bucket.count) * 100;
                        return (
                          <div
                            key={k}
                            style={{ width: `${pct}%`, background: TYPE_COLORS[k], flexShrink: 0 }}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Time axis labels */}
          <div style={{ display: 'flex', gap: '2px', minWidth: 'max-content', marginTop: '4px' }}>
            {heatmap.buckets.map((bucket, i) => (
              <div
                key={bucket.bucket_start}
                style={{
                  flex: '1 1 0',
                  minWidth: '40px',
                  maxWidth: '80px',
                  fontSize: '10px',
                  color: '#6e7681',
                  textAlign: 'center',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  visibility: i % labelEvery === 0 ? 'visible' : 'hidden',
                }}
              >
                {formatBucketLabel(bucket.bucket_start, heatmap.bucket_size)}
              </div>
            ))}
          </div>
        </div>

        {/* Event detail panel */}
        {selectedBucket && (
          <div style={{ marginTop: '16px', borderTop: '1px solid #30363d', paddingTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <span style={{ color: '#e6edf3', fontSize: '13px', fontWeight: 600 }}>
                {formatBucketRange(selectedBucket.bucket_start, heatmap.bucket_size)}
              </span>
              <span
                style={{
                  background: '#21262d',
                  color: '#8b949e',
                  borderRadius: '10px',
                  padding: '2px 8px',
                  fontSize: '11px',
                }}
              >
                {selectedBucket.count} events
              </span>
              <button type="button"
                onClick={() => setSelectedBucket(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#6e7681',
                  cursor: 'pointer',
                  fontSize: '13px',
                  marginLeft: 'auto',
                }}
                title="Deselect"
              >
                &#x2715;
              </button>
            </div>

            {/* Type breakdown pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
              {TYPE_KEYS.filter((k) => selectedBucket.by_type[k] > 0).map((k) => (
                <span
                  key={k}
                  style={{
                    background: `${TYPE_COLORS[k]}22`,
                    color: TYPE_COLORS[k],
                    border: `1px solid ${TYPE_COLORS[k]}44`,
                    borderRadius: '12px',
                    padding: '2px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                >
                  {selectedBucket.by_type[k]} {TYPE_LABELS[k]}
                </span>
              ))}
            </div>

            {/* Events list */}
            {bucketEvents.length > 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                }}
              >
                {bucketEvents.map((entry) => {
                  const color = ACTION_TYPE_COLORS[entry.action_type] ?? '#8b949e';
                  return (
                    <div
                      key={entry.resource_id + entry.ts}
                      style={{
                        background: '#0d1117',
                        border: '1px solid #30363d',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        display: 'flex',
                        gap: '10px',
                        alignItems: 'flex-start',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        title={new Date(entry.ts).toLocaleString()}
                        style={{ color: '#6e7681', fontSize: '11px', whiteSpace: 'nowrap', cursor: 'default', paddingTop: '2px' }}
                      >
                        {relativeTime(entry.ts)}
                      </span>
                      <span
                        style={{
                          background: '#21262d',
                          color: '#8b949e',
                          borderRadius: '10px',
                          padding: '2px 7px',
                          fontSize: '10px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {entry.user_email}
                      </span>
                      <span
                        style={{
                          background: `${color}22`,
                          color,
                          border: `1px solid ${color}44`,
                          borderRadius: '10px',
                          padding: '2px 7px',
                          fontSize: '10px',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {entry.action_type.replace(/_/g, ' ')}
                      </span>
                      <span style={{ color: '#c9d1d9', fontSize: '12px', flex: 1 }}>{entry.description}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ color: '#6e7681', fontSize: '13px' }}>
                {fullTimeline ? 'No detailed timeline events in this window.' : 'Loading events…'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
