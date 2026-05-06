import React, { useState, useMemo, useDeferredValue, useRef, useEffect, useCallback } from 'react';
import { useReactTable, getCoreRowModel, getSortedRowModel, flexRender } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ChevronDown, ChevronUp, AlertCircle, AlertTriangle, Activity, Search,
  Rows3, AlignJustify, Flame, CircleDot,
} from 'lucide-react';
import CohortFilterBar from './CohortFilterBar';
import EmptyState from './EmptyState';
import { applyFilters, isFilterActive } from '../filters';

// Build a filename slug encoding all active cross-filter dimensions, so users can
// see which slice they exported even after files are renamed.
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

// Column widths in px. Total ≈ 810 + flex for the driver column.
const COL_WIDTHS = {
  Patient_ID: 120,
  demographics: 140,
  Severity: 140,
  Stage_1_Admission_Risk: 130,
  Stage_2_Readmission_Risk: 140,
  driver: 240,
};

export default function PredictionsDirectory({ data, thresholds, filters, updateFilters, clearAllFilters, onJumpToEDA, openSlideOut }) {
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [sorting, setSorting] = useState([{ id: 'Stage_1_Admission_Risk', desc: true }]);
  const [density, setDensity] = useState('comfortable'); // 'comfortable' | 'compact'
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
      size: COL_WIDTHS.Patient_ID,
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
      size: COL_WIDTHS.demographics,
      cell: ({ row }) => `${row.original.Age} yrs • ${row.original.Sex}`,
    },
    {
      id: 'Severity',
      accessorKey: 'Severity',
      header: 'Severity',
      enableSorting: true,
      size: COL_WIDTHS.Severity,
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
      header: 'Adm. Risk',
      enableSorting: true,
      size: COL_WIDTHS.Stage_1_Admission_Risk,
      cell: ({ getValue }) => (
        <span className="display-num">{(getValue() * 100).toFixed(1)}%</span>
      ),
    },
    {
      id: 'Stage_2_Readmission_Risk',
      // null → undefined so TanStack's sortUndefined: 'last' kicks in (always
      // sorts undefined to the end regardless of asc/desc).
      accessorFn: (row) => row.Stage_2_Readmission_Risk ?? undefined,
      header: 'Readmit Risk',
      enableSorting: true,
      sortUndefined: 'last',
      size: COL_WIDTHS.Stage_2_Readmission_Risk,
      cell: ({ getValue }) => {
        const v = getValue();
        return v != null ? (
          <span className="display-num" style={{ color: v >= thresholds.readmission ? 'var(--warning)' : 'var(--text-main)' }}>
            {(v * 100).toFixed(1)}%
          </span>
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>N/A</span>
        );
      },
    },
    {
      id: 'driver',
      header: 'Primary Driver',
      enableSorting: false,
      size: COL_WIDTHS.driver,
      cell: ({ row }) => {
        const drivers = row.original.Top_Risk_Drivers;
        return drivers && drivers.length > 0 ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)', fontSize: '0.85rem' }}>
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
  const rowHeight = density === 'compact' ? 52 : 76;

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => rowHeight,
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
      openSlideOut(row.original);
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

  // Re-focus the tracked row after virtualizer remounts. Without this, scrolling
  // away from a focused row drops focus to <body>.
  useEffect(() => {
    if (focusedRowIndex < 0) return;
    const el = tableContainerRef.current?.querySelector(`[data-row-index="${focusedRowIndex}"]`);
    if (el && document.activeElement !== el) {
      el.focus({ preventScroll: true });
    }
  }, [focusedRowIndex, virtualRows.length]);

  const sortIcon = (header) => {
    if (!header.column.getCanSort()) return null;
    const dir = header.column.getIsSorted();
    if (dir === 'desc') return <ChevronDown size={14} />;
    if (dir === 'asc')  return <ChevronUp size={14} />;
    return (
      <span style={{ display: 'inline-flex', flexDirection: 'column', opacity: 0.35, lineHeight: 0.7 }} aria-hidden="true">
        <ChevronUp size={10} />
        <ChevronDown size={10} />
      </span>
    );
  };

  return (
    <div className="glass-card table-view-container" style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="card-title-row">
        <div>
          <h2><Activity color="var(--primary)" size={26} /> Patient Predictions</h2>
          <p>Showing {rows.length.toLocaleString()} matching patients</p>
        </div>
        <div className="pred-view-toggle" role="group" aria-label="Row density">
          <button
            type="button"
            onClick={() => setDensity('comfortable')}
            className={density === 'comfortable' ? 'active' : ''}
            aria-pressed={density === 'comfortable'}
            aria-label="Comfortable density"
            title="Comfortable"
          >
            <Rows3 size={16} />
          </button>
          <button
            type="button"
            onClick={() => setDensity('compact')}
            className={density === 'compact' ? 'active' : ''}
            aria-pressed={density === 'compact'}
            aria-label="Compact density"
            title="Compact"
          >
            <AlignJustify size={16} />
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
        <div className="virtual-table-shell">
          <div className="virtual-table-hint">
            Sorted by <strong>{sorting[0]?.id.replace(/_/g, ' ').toLowerCase() || 'default'}</strong>
            {sorting[0] && (sorting[0].desc ? ' (highest first)' : ' (lowest first)')}.
            Click any column header to re-sort. Arrow keys to navigate rows.
          </div>
          <div ref={tableContainerRef} className="virtual-table-scroller">
            <table className="virtual-data-grid">
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => {
                      const canSort = header.column.getCanSort();
                      const isLastCol = header.column.id === 'driver';
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
                          style={{
                            width: header.getSize(),
                            flex: isLastCol ? '1' : `0 0 ${header.getSize()}px`,
                            cursor: canSort ? 'pointer' : 'default',
                          }}
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
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
                  return (
                    <tr
                      key={row.id}
                      data-row-index={virtualRow.index}
                      tabIndex={0}
                      role="button"
                      aria-label={`View patient ${row.original.Patient_ID}`}
                      onClick={() => openSlideOut(row.original)}
                      onKeyDown={(e) => handleRowKeyDown(e, row, virtualRow.index)}
                      onFocus={() => setFocusedRowIndex(virtualRow.index)}
                      className="virtual-row"
                      style={{
                        height: `${rowHeight}px`,
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                        display: 'flex',
                      }}
                    >
                      {row.getVisibleCells().map(cell => {
                        const isLastCol = cell.column.id === 'driver';
                        return (
                          <td
                            key={cell.id}
                            style={{
                              width: cell.column.getSize(),
                              flex: isLastCol ? '1' : `0 0 ${cell.column.getSize()}px`,
                              padding: density === 'compact' ? '0.55rem 1rem' : '1rem 1.5rem',
                            }}
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
      )}
    </div>
  );
}
