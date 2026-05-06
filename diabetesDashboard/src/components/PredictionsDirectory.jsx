import React, { useState, useMemo, useDeferredValue, useRef, useEffect, useCallback } from 'react';
import { useReactTable, getCoreRowModel, getSortedRowModel, flexRender } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ChevronDown, ChevronUp, AlertCircle, AlertTriangle, Activity, Search,
  List, LayoutGrid, Flame, CircleDot,
} from 'lucide-react';
import CohortFilterBar from './CohortFilterBar';
import EmptyState from './EmptyState';
import { applyFilters, isFilterActive } from '../filters';

// Build a filename slug encoding all active cross-filter dimensions.
const slugifyFilters = (filters) => {
  const cleanSlug = (s) => String(s).replace(/[<>+%]/g, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const parts = [
    filters.gender !== 'All' && `sex-${filters.gender}`,
    filters.severity !== 'All' && `sev-${filters.severity}`,
    filters.ageBand && `age-${cleanSlug(filters.ageBand)}`,
    filters.riskBand && `risk-${cleanSlug(filters.riskBand)}`,
  ].filter(Boolean);
  return parts.length > 0 ? '_' + parts.join('_') : '';
};

const SEVERITY_ICON_MAP = { Severe: Flame, Moderate: AlertTriangle, Mild: CircleDot };
const SeverityIcon = ({ severity, size = 14 }) => {
  const Icon = SEVERITY_ICON_MAP[severity];
  return Icon ? <Icon size={size} /> : null;
};

// Severe > Moderate > Mild (clinical priority), NOT alphabetical.
const SEVERITY_ORDER = { Severe: 0, Moderate: 1, Mild: 2 };
const severityOrderSortFn = (rowA, rowB) => {
  const a = SEVERITY_ORDER[rowA.original.Severity] ?? 99;
  const b = SEVERITY_ORDER[rowB.original.Severity] ?? 99;
  return a - b;
};

// Per-column horizontal alignment. Numeric/badge columns center; identifiers
// and free-text driver column align left.
const COL_ALIGN = {
  Patient_ID: 'left',
  demographics: 'center',
  Severity: 'center',
  Stage_1_Admission_Risk: 'center',
  Stage_2_Readmission_Risk: 'center',
  driver: 'left',
};

const ROW_HEIGHT = 72;
const TILE_LIMIT = 20; // mirrors the original tile view's cap before Step 4

export default function PredictionsDirectory({ data, thresholds, filters, updateFilters, clearAllFilters, onJumpToEDA, openSlideOut }) {
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [sorting, setSorting] = useState([{ id: 'Stage_1_Admission_Risk', desc: true }]);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'tiles'
  const [focusedRowIndex, setFocusedRowIndex] = useState(-1);
  const tableContainerRef = useRef(null);

  const handleSearchInput = useCallback((value) => setSearchQuery(value), []);

  // Cross-filter (App-level) → patient-ID search (deferred for typing responsiveness).
  // TanStack handles sorting downstream.
  const processedData = useMemo(() => {
    let result = applyFilters(data, filters);
    if (deferredSearchQuery.trim() !== '') {
      const q = deferredSearchQuery.toLowerCase();
      result = result.filter(d => d.Patient_ID.toLowerCase().includes(q));
    }
    return result;
  }, [data, filters, deferredSearchQuery]);

  const columns = useMemo(() => [
    {
      id: 'Patient_ID',
      accessorKey: 'Patient_ID',
      header: 'ID',
      enableSorting: true,
      cell: ({ getValue }) => (
        <span style={{ fontWeight: 600, color: 'var(--text-main)', fontFamily: 'Manrope, sans-serif' }}>
          {getValue()}
        </span>
      ),
    },
    {
      id: 'demographics',
      header: 'Demographics',
      enableSorting: false,
      cell: ({ row }) => (
        <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
          {row.original.Age} yrs · {row.original.Sex}
        </span>
      ),
    },
    {
      id: 'Severity',
      accessorKey: 'Severity',
      header: 'Severity',
      enableSorting: true,
      sortingFn: severityOrderSortFn,
      cell: ({ getValue }) => {
        const severity = getValue();
        return (
          <span className={`badge ${severity.toLowerCase()}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <SeverityIcon severity={severity} size={12} />
            {severity}
          </span>
        );
      },
    },
    {
      id: 'Stage_1_Admission_Risk',
      accessorKey: 'Stage_1_Admission_Risk',
      header: 'Admission risk',
      enableSorting: true,
      cell: ({ getValue }) => {
        const v = getValue();
        const flagged = v >= thresholds.admission;
        return (
          <span className="display-num" style={{ color: flagged ? 'var(--danger)' : 'var(--text-main)' }}>
            {(v * 100).toFixed(1)}%
          </span>
        );
      },
    },
    {
      id: 'Stage_2_Readmission_Risk',
      // null → undefined so TanStack's sortUndefined: 'last' kicks in regardless of asc/desc.
      accessorFn: (row) => row.Stage_2_Readmission_Risk ?? undefined,
      header: 'Readmission risk',
      enableSorting: true,
      sortUndefined: 'last',
      cell: ({ getValue }) => {
        const v = getValue();
        if (v == null) return <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>N/A</span>;
        const flagged = v >= thresholds.readmission;
        return (
          <span className="display-num" style={{ color: flagged ? 'var(--warning)' : 'var(--text-main)' }}>
            {(v * 100).toFixed(1)}%
          </span>
        );
      },
    },
    {
      id: 'driver',
      header: 'Primary driver',
      enableSorting: false,
      cell: ({ row }) => {
        const drivers = row.original.Top_Risk_Drivers;
        return drivers && drivers.length > 0 ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--danger)', fontSize: '0.85rem' }}>
            <AlertCircle size={14} /> {drivers[0].split(' (+')[0]}
          </span>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>—</span>
        );
      },
    },
  ], [thresholds]);

  const table = useReactTable({
    data: processedData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const { rows } = table.getRowModel();

  // Sibling list for slideout arrow-key navigation — Patient_IDs in current
  // sort/filter/search order. Memoized; reference stable per render.
  const siblings = useMemo(() => rows.map(r => r.original.Patient_ID), [rows]);
  const openWithSiblings = useCallback(
    (patient) => openSlideOut(patient, siblings),
    [openSlideOut, siblings]
  );

  // Top-N tile slice. Tiles aren't virtualized — we cap to TILE_LIMIT so the
  // grid stays browsable rather than overwhelming.
  const tileItems = useMemo(() => rows.slice(0, TILE_LIMIT), [rows]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const handleExportCSV = () => {
    if (rows.length === 0) return;
    const headers = ['Patient_ID', 'Age', 'Sex', 'Severity', 'Admission_Risk_Pct', 'Readmission_Risk_Pct', 'Top_SHAP_Factor'];
    const csvRows = rows.map(r => {
      const p = r.original;
      return [
        p.Patient_ID, p.Age, p.Sex, p.Severity,
        (p.Stage_1_Admission_Risk * 100).toFixed(1) + '%',
        p.Stage_2_Readmission_Risk !== null ? (p.Stage_2_Readmission_Risk * 100).toFixed(1) + '%' : 'N/A',
        p.Top_Risk_Drivers && p.Top_Risk_Drivers.length > 0 ? `"${p.Top_Risk_Drivers[0]}"` : '-',
      ];
    });
    const csv = [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `cohort_export${slugifyFilters(filters)}_by_${sorting[0]?.id || 'default'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRowKeyDown = (e, row, virtualRowIndex) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openWithSiblings(row.original);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min(rows.length - 1, virtualRowIndex + 1);
      setFocusedRowIndex(next);
      rowVirtualizer.scrollToIndex(next, { align: 'auto' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = Math.max(0, virtualRowIndex - 1);
      setFocusedRowIndex(prev);
      rowVirtualizer.scrollToIndex(prev, { align: 'auto' });
    }
  };

  // Re-focus the tracked row after virtualizer remounts.
  useEffect(() => {
    if (focusedRowIndex < 0 || viewMode !== 'table') return;
    const el = tableContainerRef.current?.querySelector(`[data-row-index="${focusedRowIndex}"]`);
    if (el && document.activeElement !== el) {
      el.focus({ preventScroll: true });
    }
  }, [focusedRowIndex, virtualRows.length, viewMode]);

  const sortIcon = (header) => {
    if (!header.column.getCanSort()) return null;
    const dir = header.column.getIsSorted();
    if (dir === 'desc') return <ChevronDown size={14} />;
    if (dir === 'asc')  return <ChevronUp size={14} />;
    return (
      <span style={{ display: 'inline-flex', flexDirection: 'column', opacity: 0.4, lineHeight: 0.7 }} aria-hidden="true">
        <ChevronUp size={10} />
        <ChevronDown size={10} />
      </span>
    );
  };

  // ─── Tiles view ──────────────────────────────────────────────────────
  // Restored to the original (pre-Step-4) design after user feedback —
  // top-N spotlight cards with centered layout, large risk numbers, and
  // a top-edge severity accent. Reuses the original .patient-card +
  // .grid-container CSS that was preserved in index.css. Cap mirrors
  // the original 20-tile limit; the table view holds the full list.
  // Wrapped in .tile-scroll-host so the grid scrolls inside the card
  // shell rather than the parent .main-content.
  const renderTiles = () => (
    <div className="tile-scroll-host">
      <div className="grid-container">
        {tileItems.map((row) => {
          const patient = row.original;
          const severityClass = patient.Severity.toLowerCase();
          const admFlagged = patient.Stage_1_Admission_Risk >= thresholds.admission;
          const readmFlagged = patient.Stage_2_Readmission_Risk !== null
            && patient.Stage_2_Readmission_Risk >= thresholds.readmission;
          const topDriver = patient.Top_Risk_Drivers?.[0]?.split(' (+')[0];
          return (
            <div
              key={patient.Patient_ID}
              className={`patient-card ${severityClass}`}
              onClick={() => openWithSiblings(patient)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openWithSiblings(patient);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`View patient ${patient.Patient_ID}`}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: '280px' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <span className={`badge ${severityClass}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <SeverityIcon severity={patient.Severity} size={12} />
                  {patient.Severity}
                </span>
                <h3 style={{ fontSize: '1.5rem', margin: '0', color: 'var(--text-main)' }}>{patient.Patient_ID}</h3>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>{patient.Age} yrs • {patient.Sex}</p>
              </div>

              <div style={{ margin: '1.5rem 0', display: 'flex', justifyContent: 'center', gap: '2rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Admit Risk</div>
                  <div className="display-num" style={{ fontSize: '2rem', color: admFlagged ? 'var(--danger)' : 'var(--text-main)' }}>
                    {(patient.Stage_1_Admission_Risk * 100).toFixed(0)}<span style={{ fontSize: '1.25rem' }}>%</span>
                  </div>
                </div>
                {patient.Stage_2_Readmission_Risk !== null && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Readmit Risk</div>
                    <div className="display-num" style={{ fontSize: '2rem', color: readmFlagged ? 'var(--warning)' : 'var(--text-main)' }}>
                      {(patient.Stage_2_Readmission_Risk * 100).toFixed(0)}<span style={{ fontSize: '1.25rem' }}>%</span>
                    </div>
                  </div>
                )}
              </div>

              {topDriver && (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', background: 'var(--bg-surface)', padding: '0.75rem 1.25rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', display: 'inline-block' }}>
                  <span style={{ color: 'var(--danger)', fontWeight: '600', marginRight: '0.5rem' }}>↑ Drivers:</span>
                  {topDriver}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {rows.length > TILE_LIMIT && (
        <div className="tile-cap-hint">
          Showing top {TILE_LIMIT.toLocaleString()} of {rows.length.toLocaleString()} patients.
          Switch to Table view for the full sorted list.
        </div>
      )}
    </div>
  );

  // ─── Table view ──────────────────────────────────────────────────────
  const renderTable = () => (
    <div className="virtual-table-shell">
      <div className="virtual-table-hint">
        Sorted by <strong>{sorting[0]?.id.replace(/_/g, ' ').toLowerCase() || 'default'}</strong>
        {sorting[0] && (sorting[0].desc ? ' (highest first)' : ' (lowest first)')}.
        Click any column header to re-sort. Arrow keys to navigate rows.
      </div>
      <div ref={tableContainerRef} className="virtual-table-scroller">
        <table className="virtual-data-grid" role="table">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  const canSort = header.column.getCanSort();
                  const align = COL_ALIGN[header.column.id] || 'left';
                  return (
                    <th
                      key={header.id}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      onKeyDown={canSort ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          header.column.toggleSorting();
                        }
                      } : undefined}
                      tabIndex={canSort ? 0 : undefined}
                      role={canSort ? 'button' : undefined}
                      aria-sort={
                        header.column.getIsSorted() === 'desc' ? 'descending' :
                        header.column.getIsSorted() === 'asc'  ? 'ascending'  : 'none'
                      }
                      className={`pd-cell pd-cell-${align} ${canSort ? 'pd-cell-sortable' : ''}`}
                    >
                      <span className="pd-th-inner">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sortIcon(header)}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody style={{ position: 'relative', height: `${totalSize}px`, display: 'block' }}>
            {virtualRows.map(virtualRow => {
              const row = rows[virtualRow.index];
              const sevClass = `severity-${row.original.Severity.toLowerCase()}`;
              return (
                <tr
                  key={row.id}
                  data-row-index={virtualRow.index}
                  tabIndex={0}
                  role="button"
                  aria-label={`View patient ${row.original.Patient_ID}`}
                  onClick={() => openWithSiblings(row.original)}
                  onKeyDown={(e) => handleRowKeyDown(e, row, virtualRow.index)}
                  onFocus={() => setFocusedRowIndex(virtualRow.index)}
                  className={`virtual-row ${sevClass}`}
                  style={{
                    height: `${ROW_HEIGHT}px`,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {row.getVisibleCells().map(cell => {
                    const align = COL_ALIGN[cell.column.id] || 'left';
                    return (
                      <td
                        key={cell.id}
                        className={`pd-cell pd-cell-${align}`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="glass-card table-view-container" style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="card-title-row">
        <div>
          <h2><Activity color="var(--primary)" size={26} /> Patient Predictions</h2>
          <p>Showing {rows.length.toLocaleString()} matching patients</p>
        </div>
        <div className="pred-view-toggle" role="group" aria-label="View mode">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={viewMode === 'table' ? 'active' : ''}
            aria-pressed={viewMode === 'table'}
            aria-label="Table view"
            title="Table view"
          >
            <List size={16} /> <span>Table</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('tiles')}
            className={viewMode === 'tiles' ? 'active' : ''}
            aria-pressed={viewMode === 'tiles'}
            aria-label="Tiles view"
            title="Tiles view"
          >
            <LayoutGrid size={16} /> <span>Tiles</span>
          </button>
        </div>
      </div>

      <CohortFilterBar
        data={data}
        filters={filters}
        updateFilters={updateFilters}
        clearAllFilters={clearAllFilters}
        variant="predictions"
        onJumpToEDA={onJumpToEDA}
        searchQuery={searchQuery}
        onSearchChange={handleSearchInput}
        onExportCSV={handleExportCSV}
      />

      {rows.length === 0 ? (
        <div style={{ padding: '2rem' }}>
          <EmptyState
            icon={Search}
            title="No patients match the current filters or search."
            action={(isFilterActive(filters) || searchQuery)
              ? { label: 'Clear filters & search', onClick: () => { clearAllFilters(); setSearchQuery(''); } }
              : undefined}
          />
        </div>
      ) : (
        viewMode === 'tiles' ? renderTiles() : renderTable()
      )}
    </div>
  );
}
