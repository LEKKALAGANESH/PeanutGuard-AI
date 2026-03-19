'use client';

import { useBulkScanStore } from '@/stores/bulk-scan-store';
import { useDesktopUIStore } from '@/stores/desktop-ui-store';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { BulkScanStatus } from '@/types/desktop';

const STATUS_COLORS: Record<BulkScanStatus, string> = {
  queued: '#64748b',
  preprocessing: '#3b82f6',
  gate: '#3b82f6',
  classifying: '#8b5cf6',
  detecting: '#a855f7',
  complete: '#22c55e',
  error: '#ef4444',
  skipped: '#94a3b8',
};

const DISEASE_COLORS = [
  '#ef4444', '#f59e0b', '#f97316', '#84cc16', '#06b6d4',
  '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1', '#e11d48',
];

interface BatchSidebarProps {
  onExportPDF: () => void;
  onExportCSV: () => void;
}

export function BatchSidebar({ onExportPDF, onExportCSV }: BatchSidebarProps) {
  const items = useBulkScanStore((s) => s.items);
  const stats = useBulkScanStore((s) => s.stats);
  const filters = useDesktopUIStore((s) => s.filters);
  const sort = useDesktopUIStore((s) => s.sort);
  const setFilters = useDesktopUIStore((s) => s.setFilters);
  const setSort = useDesktopUIStore((s) => s.setSort);
  const setZoomTarget = useDesktopUIStore((s) => s.setZoomTarget);
  const sidebarOpen = useDesktopUIStore((s) => s.sidebarOpen);

  if (!sidebarOpen) return null;

  // Pie chart data
  const pieData = Object.entries(stats.diseaseDistribution).map(
    ([name, value]) => ({ name: name.replace(/_/g, ' '), value }),
  );
  if (stats.healthy > 0) {
    pieData.unshift({ name: 'healthy', value: stats.healthy });
  }

  // Unique diseases for filter dropdown
  const diseases = Array.from(
    new Set(
      items
        .filter((i) => i.result?.predictions[0])
        .map((i) => i.result!.predictions[0].diseaseLabel),
    ),
  );

  return (
    <aside className="glass-sidebar desktop-scrollbar flex w-[280px] shrink-0 flex-col overflow-y-auto">
      {/* Stats cards */}
      <div className="border-b border-slate-800 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Batch Stats
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Total" value={stats.total} color="text-slate-300" />
          <StatCard
            label="Complete"
            value={stats.completed}
            color="text-green-400"
          />
          <StatCard
            label="Healthy"
            value={stats.healthy}
            color="text-emerald-400"
          />
          <StatCard
            label="Diseased"
            value={stats.diseased}
            color="text-amber-400"
          />
          <StatCard
            label="Failed"
            value={stats.failed}
            color="text-red-400"
          />
          <StatCard
            label="Avg Conf"
            value={`${Math.round(stats.avgConfidence * 100)}%`}
            color="text-blue-400"
          />
        </div>
      </div>

      {/* Pie chart */}
      {pieData.length > 0 && (
        <div className="border-b border-slate-800 p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Distribution
          </h3>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={28}
                  outerRadius={55}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {pieData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={
                        i === 0 && stats.healthy > 0
                          ? '#22c55e'
                          : DISEASE_COLORS[
                              (stats.healthy > 0 ? i - 1 : i) %
                                DISEASE_COLORS.length
                            ]
                      }
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'rgba(15,23,42,0.9)',
                    border: '1px solid rgba(148,163,184,0.2)',
                    borderRadius: '8px',
                    color: '#e2e8f0',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="border-b border-slate-800 p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Filters
        </h3>
        <select
          value={filters.disease ?? ''}
          onChange={(e) =>
            setFilters({ disease: e.target.value || undefined })
          }
          className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-300"
        >
          <option value="">All Diseases</option>
          {diseases.map((d) => (
            <option key={d} value={d}>
              {d.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <select
          value={filters.status ?? ''}
          onChange={(e) =>
            setFilters({
              status: (e.target.value as BulkScanStatus) || undefined,
            })
          }
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-300"
        >
          <option value="">All Status</option>
          <option value="queued">Queued</option>
          <option value="complete">Complete</option>
          <option value="error">Error</option>
          <option value="skipped">Skipped</option>
        </select>
      </div>

      {/* Sort */}
      <div className="border-b border-slate-800 p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Sort
        </h3>
        <div className="flex flex-wrap gap-1">
          {(['name', 'confidence', 'severity', 'time'] as const).map((key) => (
            <button
              key={key}
              onClick={() =>
                setSort({
                  sortBy: key,
                  direction:
                    sort.sortBy === key
                      ? sort.direction === 'asc'
                        ? 'desc'
                        : 'asc'
                      : 'desc',
                })
              }
              className={`rounded-md px-2 py-1 text-xs capitalize transition-colors ${
                sort.sortBy === key
                  ? 'bg-green-900/50 text-green-300'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {key}
              {sort.sortBy === key && (sort.direction === 'asc' ? ' ↑' : ' ↓')}
            </button>
          ))}
        </div>
      </div>

      {/* Queue list */}
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Queue ({items.length})
        </h3>
        <div className="flex flex-col gap-1">
          {items.slice(0, 100).map((item) => (
            <button
              key={item.id}
              onClick={() => setZoomTarget(item.id)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-slate-800/60"
            >
              {item.thumbnail ? (
                <img
                  src={item.thumbnail}
                  alt=""
                  className="h-8 w-8 rounded object-cover"
                />
              ) : (
                <div className="h-8 w-8 rounded bg-slate-800" />
              )}
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-xs text-slate-300">
                  {item.fileName}
                </p>
              </div>
              <div
                className="status-dot shrink-0"
                style={{ background: STATUS_COLORS[item.status] }}
              />
            </button>
          ))}
          {items.length > 100 && (
            <p className="mt-1 text-center text-xs text-slate-600">
              +{items.length - 100} more
            </p>
          )}
        </div>
      </div>

      {/* Export buttons */}
      <div className="flex gap-2 border-t border-slate-800 p-4">
        <button
          onClick={onExportPDF}
          className="flex-1 rounded-lg bg-slate-700/80 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-600"
        >
          Export PDF
        </button>
        <button
          onClick={onExportCSV}
          className="flex-1 rounded-lg bg-slate-700/80 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-600"
        >
          Export CSV
        </button>
      </div>
    </aside>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="rounded-lg bg-slate-800/50 px-3 py-2 text-center">
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-slate-500">{label}</p>
    </div>
  );
}
