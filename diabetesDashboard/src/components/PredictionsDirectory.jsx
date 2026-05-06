import React, { useState, useMemo, useDeferredValue } from 'react';
import { ChevronDown, ChevronUp, AlertCircle, AlertTriangle, TrendingUp, Activity, ChevronLeft, ChevronRight, Search, Download, LayoutGrid, List, Flame, CircleDot } from 'lucide-react';
import PatientSlideOut from './PatientSlideOut';
import FilterChips from './FilterChips';
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

export default function PredictionsDirectory({ data, thresholds, filters, updateFilters, clearAllFilters }) {
  const [sortField, setSortField] = useState('Stage_1_Admission_Risk');
  const [sortDesc, setSortDesc] = useState(true);
  
  // Search state — typing stays responsive while the expensive filter+sort uses
  // the deferred value so React can keep input updates high-priority.
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Slideout state
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isSlideOpen, setIsSlideOpen] = useState(false);

  // View Toggle State (Stitch Grid Idea)
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'grid'

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Process: cross-filter (App-level state) → local search (deferred) → sort.
  const processedData = useMemo(() => {
    let result = applyFilters(data, filters);

    if (deferredSearchQuery.trim() !== '') {
      const q = deferredSearchQuery.toLowerCase();
      result = result.filter(d => d.Patient_ID.toLowerCase().includes(q));
    }

    return result.slice().sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      // Handle nulls gracefully in readmission sorting
      if (valA === null) valA = -1;
      if (valB === null) valB = -1;

      let comparison = 0;
      if (valA > valB) comparison = 1;
      else if (valA < valB) comparison = -1;

      return sortDesc ? comparison * -1 : comparison;
    });
  }, [data, filters, sortField, sortDesc, deferredSearchQuery]);

  // Handle Pagination Logic
  const totalPages = Math.ceil(processedData.length / itemsPerPage);
  const currentItems = processedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDesc(!sortDesc);
    } else {
      setSortField(field);
      setSortDesc(true);
    }
    setCurrentPage(1); // Reset to first page on sort
  };

  const handleFilter = (f) => {
    updateFilters({ severity: f });
    setCurrentPage(1); // Reset to first page on filter
  }

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1); // Reset pagination naturally
  }
  
  const handleExportCSV = () => {
    // Generate CSV only off the filtered processedData (could be 62k or 1 if searched)
    if (processedData.length === 0) return;
    
    const headers = ['Patient_ID', 'Age', 'Sex', 'Severity', 'Admission_Risk_Pct', 'Readmission_Risk_Pct', 'Top_SHAP_Factor'];
    
    const rows = processedData.map(p => [
      p.Patient_ID,
      p.Age,
      p.Sex,
      p.Severity,
      (p.Stage_1_Admission_Risk * 100).toFixed(1) + '%',
      p.Stage_2_Readmission_Risk !== null ? (p.Stage_2_Readmission_Risk * 100).toFixed(1) + '%' : 'N/A',
      p.Top_Risk_Drivers && p.Top_Risk_Drivers.length > 0 ? `"${p.Top_Risk_Drivers[0]}"` : '-'
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `cohort_export${slugifyFilters(filters)}_by_${sortField}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const openSlideOut = (patient) => {
    setSelectedPatient(patient);
    setIsSlideOpen(true);
  }

  const getSortIcon = (field) => {
    if (sortField !== field) {
      return (
        <span style={{ display: 'inline-flex', flexDirection: 'column', opacity: 0.35, lineHeight: 0.7 }} aria-hidden="true">
          <ChevronUp size={10} />
          <ChevronDown size={10} />
        </span>
      );
    }
    return sortDesc ? <ChevronDown size={14} /> : <ChevronUp size={14} />;
  };

  const ariaSortFor = (field) => sortField === field ? (sortDesc ? 'descending' : 'ascending') : 'none';
  const onHeaderKeyDown = (field) => (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSort(field);
    }
  };
  const onRowKeyDown = (patient) => (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openSlideOut(patient);
    }
  };

  const renderGridCards = () => {
    // In grid mode, we'll only show the top 20 items to prevent huge scroll
    const gridItems = currentItems.slice(0, 20);
    
    return (
      <div className="grid-container" style={{ padding: '1.5rem', flex: 1, overflowY: 'auto' }}>
        {gridItems.map((patient, idx) => {
          const severityClass = patient.Severity.toLowerCase();
          return (
            <div
              key={`${patient.Patient_ID}-${idx}`}
              className={`patient-card ${severityClass}`}
              onClick={() => openSlideOut(patient)}
              onKeyDown={onRowKeyDown(patient)}
              tabIndex={0}
              role="button"
              aria-label={`View patient ${patient.Patient_ID}`}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: '280px' }}>
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
                  <div className="display-num" style={{ fontSize: '2rem', color: patient.Stage_1_Admission_Risk >= thresholds.admission ? 'var(--danger)' : 'var(--text-main)' }}>
                    {(patient.Stage_1_Admission_Risk * 100).toFixed(0)}<span style={{ fontSize: '1.25rem' }}>%</span>
                  </div>
                </div>
                {patient.Stage_2_Readmission_Risk !== null && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Readmit Risk</div>
                    <div className="display-num" style={{ fontSize: '2rem', color: patient.Stage_2_Readmission_Risk >= thresholds.readmission ? 'var(--warning)' : 'var(--text-main)' }}>
                      {(patient.Stage_2_Readmission_Risk * 100).toFixed(0)}<span style={{ fontSize: '1.25rem' }}>%</span>
                    </div>
                  </div>
                )}
              </div>

              {patient.Top_Risk_Drivers && patient.Top_Risk_Drivers.length > 0 && (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', background: 'var(--bg-dark)', padding: '0.75rem 1.25rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', display: 'inline-block' }}>
                  <span style={{ color: 'var(--danger)', fontWeight: '600', marginRight: '0.5rem' }}>↑ Drivers:</span>
                  {patient.Top_Risk_Drivers[0].split(' (+')[0]}
                </div>
              )}
            </div>
          );
        })}
        {gridItems.length === 0 && (
          <div style={{ gridColumn: '1 / -1' }}>
            <EmptyState
              icon={Search}
              title="No patients match the current filters or search."
              action={(isFilterActive(filters) || searchQuery)
                ? { label: 'Clear filters & search', onClick: () => { clearAllFilters(); setSearchQuery(''); setCurrentPage(1); } }
                : undefined}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="glass-card table-view-container" style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity color="var(--primary)" /> Patient Predictions
            </h2>
            <p style={{ marginTop: '0.25rem', fontSize: '0.9rem' }}>Showing {processedData.length.toLocaleString()} matching patients</p>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            
            {/* View Toggle (Grid / Table) */}
            <div style={{ display: 'flex', background: 'var(--bg-dark)', borderRadius: '8px', padding: '0.25rem', border: '1px solid var(--border-light)' }}>
              <button 
                onClick={() => { setViewMode('table'); setCurrentPage(1); }}
                style={{ background: viewMode === 'table' ? 'var(--bg-surface-high)' : 'transparent', border: 'none', padding: '0.5rem', borderRadius: '6px', color: viewMode === 'table' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', transition: 'var(--transition)' }}
                title="Table View"
              ><List size={18} /></button>
              <button 
                onClick={() => { setViewMode('grid'); setCurrentPage(1); }}
                style={{ background: viewMode === 'grid' ? 'var(--bg-surface-high)' : 'transparent', border: 'none', padding: '0.5rem', borderRadius: '6px', color: viewMode === 'grid' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', transition: 'var(--transition)' }}
                title="Grid View"
              ><LayoutGrid size={18} /></button>
            </div>

            {/* Search Bar */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                placeholder="Search Patient ID..." 
                value={searchQuery}
                onChange={handleSearchChange}
                style={{
                  background: 'var(--bg-dark)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-main)',
                  padding: '0.6rem 1rem 0.6rem 2.2rem',
                  borderRadius: '8px',
                  outline: 'none',
                  fontSize: '0.9rem',
                  width: '180px',
                  transition: 'var(--transition)',
                  fontFamily: 'Inter, sans-serif'
                }}
              />
            </div>
          
            {/* CSV Export Button */}
            <button
               onClick={handleExportCSV}
               style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  background: 'var(--bg-surface-high)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border-light)',
                  padding: '0.6rem 1rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '500',
                  fontSize: '0.9rem',
                  fontFamily: 'Inter, sans-serif',
                  transition: 'var(--transition)'
               }}
            >
               <Download size={16} /> Export CSV
            </button>

            {/* Severity Tabs (dispatch to App-level filter state) */}
            <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--bg-dark)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              {['All', 'Severe', 'Moderate', 'Mild'].map(f => (
                <button
                  key={f}
                  onClick={() => handleFilter(f)}
                  style={{
                    background: filters.severity === f ? 'var(--primary)' : 'transparent',
                    color: filters.severity === f ? '#fff' : 'var(--text-muted)',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: filters.severity === f ? '600' : '500',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.85rem',
                    transition: 'var(--transition)'
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding: '0 1.5rem', marginTop: '1rem' }}>
          <FilterChips
            filters={filters}
            updateFilters={updateFilters}
            clearAllFilters={clearAllFilters}
            surface="compact"
          />
        </div>

        {viewMode === 'grid' ? renderGridCards() : (
          <div style={{ overflowX: 'auto', flex: 1, position: 'relative' }}>
            <div style={{ padding: '0.5rem 1.5rem', background: 'var(--bg-dark)', borderBottom: '1px solid var(--border-light)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
               Sorted by <strong>admission risk</strong> (highest first). Click any column header to re-sort.
            </div>
            <table className="data-grid">
              <thead>
                <tr>
                  <th
                    onClick={() => handleSort('Patient_ID')}
                    onKeyDown={onHeaderKeyDown('Patient_ID')}
                    tabIndex={0}
                    role="button"
                    aria-sort={ariaSortFor('Patient_ID')}
                    style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>ID {getSortIcon('Patient_ID')}</div>
                  </th>
                  <th style={{ textAlign: 'center' }}>Demographics</th>
                  <th
                    onClick={() => handleSort('Severity')}
                    onKeyDown={onHeaderKeyDown('Severity')}
                    tabIndex={0}
                    role="button"
                    aria-sort={ariaSortFor('Severity')}
                    style={{ cursor: 'pointer', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>Severity {getSortIcon('Severity')}</div>
                  </th>
                  <th
                    onClick={() => handleSort('Stage_1_Admission_Risk')}
                    onKeyDown={onHeaderKeyDown('Stage_1_Admission_Risk')}
                    tabIndex={0}
                    role="button"
                    aria-sort={ariaSortFor('Stage_1_Admission_Risk')}
                    style={{ cursor: 'pointer', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                      <TrendingUp size={14} /> Adm. Risk {getSortIcon('Stage_1_Admission_Risk')}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('Stage_2_Readmission_Risk')}
                    onKeyDown={onHeaderKeyDown('Stage_2_Readmission_Risk')}
                    tabIndex={0}
                    role="button"
                    aria-sort={ariaSortFor('Stage_2_Readmission_Risk')}
                    style={{ cursor: 'pointer', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                       Readmit Risk {getSortIcon('Stage_2_Readmission_Risk')}
                    </div>
                  </th>
                  <th style={{ textAlign: 'center' }}>Primary Driver</th>
                </tr>
              </thead>
              <tbody className="table-body-anim">
                {currentItems.map((patient, idx) => {
                  const severityClass = patient.Severity.toLowerCase();
                                        
                  return (
                  <tr
                    key={`${patient.Patient_ID}-${idx}`}
                    onClick={() => openSlideOut(patient)}
                    onKeyDown={onRowKeyDown(patient)}
                    tabIndex={0}
                    role="button"
                    aria-label={`View patient ${patient.Patient_ID}`}
                    className="clickable-row">
                    <td style={{ fontWeight: '600', color: 'var(--text-main)', paddingLeft: '1.5rem', fontFamily: 'Manrope, sans-serif' }}>{patient.Patient_ID}</td>
                    <td style={{ textAlign: 'center' }}>
                      {patient.Age} yrs • {patient.Sex}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${severityClass}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <SeverityIcon severity={patient.Severity} size={12} />
                        {patient.Severity}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="display-num">{(patient.Stage_1_Admission_Risk * 100).toFixed(1)}%</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {patient.Stage_2_Readmission_Risk !== null ? (
                        <span className="display-num" style={{ color: patient.Stage_2_Readmission_Risk >= thresholds.readmission ? 'var(--warning)' : 'var(--text-main)' }}>
                           {(patient.Stage_2_Readmission_Risk * 100).toFixed(1)}%
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>N/A</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {patient.Top_Risk_Drivers && patient.Top_Risk_Drivers.length > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--danger)', fontSize: '0.85rem' }}>
                          <AlertCircle size={14} /> {patient.Top_Risk_Drivers[0].split(' (+')[0]}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                  </tr>
                )})}
                {processedData.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ padding: 0, background: 'transparent' }}>
                      <EmptyState
                        icon={Search}
                        title="No patients match the current filters or search."
                        action={(isFilterActive(filters) || searchQuery)
                          ? { label: 'Clear filters & search', onClick: () => { clearAllFilters(); setSearchQuery(''); setCurrentPage(1); } }
                          : undefined}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div style={{ 
            padding: '1rem 1.5rem', 
            borderTop: '1px solid var(--border-light)', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            background: 'var(--bg-surface)',
            borderBottomLeftRadius: '1.5rem',
            borderBottomRightRadius: '1.5rem'
          }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Showing {viewMode === 'grid' ? Math.min(20, processedData.length) : ((currentPage - 1) * itemsPerPage + 1) + ' - ' + Math.min(currentPage * itemsPerPage, processedData.length)} of {processedData.length.toLocaleString()} patients
            </span>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button 
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                style={{
                  background: 'var(--bg-dark)', border: '1px solid var(--border-light)', color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-main)', padding: '0.5rem', borderRadius: '8px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                }}
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: '0.9rem', margin: '0 0.5rem', fontFamily: 'Inter, sans-serif' }}>Page {currentPage} of {totalPages.toLocaleString()}</span>
              <button 
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                style={{
                  background: 'var(--bg-dark)', border: '1px solid var(--border-light)', color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-main)', padding: '0.5rem', borderRadius: '8px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      <PatientSlideOut
        patient={selectedPatient}
        isOpen={isSlideOpen}
        onClose={() => setIsSlideOpen(false)}
        thresholds={thresholds}
        data={data}
      />
    </>
  );
}
