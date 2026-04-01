import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, AlertCircle, TrendingUp, Activity, ChevronLeft, ChevronRight, Search, Download, LayoutGrid, List } from 'lucide-react';
import PatientSlideOut from './PatientSlideOut';

export default function PredictionsDirectory({ data }) {
  const [filter, setFilter] = useState('All');
  const [sortField, setSortField] = useState('Stage_1_Admission_Risk');
  const [sortDesc, setSortDesc] = useState(true);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Slideout state
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isSlideOpen, setIsSlideOpen] = useState(false);

  // View Toggle State (Stitch Grid Idea)
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'grid'

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Process filtering, searching, and sorting efficiently using useMemo
  const processedData = useMemo(() => {
    let result = data;
    
    // 1. Search Logic
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      result = result.filter(d => 
        d.Patient_ID.toLowerCase().includes(q)
      );
    }
    
    // 2. Filter Logic
    if (filter !== 'All') {
      result = result.filter(d => d.Severity === filter);
    }
    
    // 3. Sort Logic
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
  }, [data, filter, sortField, sortDesc, searchQuery]);

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
    setFilter(f);
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
    link.download = `cohort_export_${filter}_sortedBy_${sortField}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const openSlideOut = (patient) => {
    setSelectedPatient(patient);
    setIsSlideOpen(true);
  }

  const getSortIcon = (field) => {
    if (sortField !== field) return null;
    return sortDesc ? <ChevronDown size={14} /> : <ChevronUp size={14} />;
  };

  const renderGridCards = () => {
    // In grid mode, we'll only show the top 20 items to prevent huge scroll
    const gridItems = currentItems.slice(0, 20);
    
    return (
      <div className="grid-container" style={{ padding: '1.5rem', flex: 1, overflowY: 'auto' }}>
        {gridItems.map((patient, idx) => {
          const severityClass = patient.Severity.toLowerCase();
          return (
            <div key={`${patient.Patient_ID}-${idx}`} className={`patient-card ${severityClass}`} onClick={() => openSlideOut(patient)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '0.2rem', color: '#fff' }}>{patient.Patient_ID}</h3>
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>{patient.Age} yrs • {patient.Sex}</p>
                </div>
                <span className={`badge ${severityClass}`}>{patient.Severity}</span>
              </div>
              
              <div style={{ margin: '1.5rem 0', display: 'flex', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Admit Risk</div>
                  <div className="display-num" style={{ fontSize: '2rem', color: patient.Stage_1_Admission_Risk > 0.5 ? 'var(--danger)' : '#fff' }}>
                    {(patient.Stage_1_Admission_Risk * 100).toFixed(0)}<span style={{ fontSize: '1.25rem' }}>%</span>
                  </div>
                </div>
                {patient.Stage_2_Readmission_Risk !== null && (
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Readmit Risk</div>
                    <div className="display-num" style={{ fontSize: '2rem', color: patient.Stage_2_Readmission_Risk > 0.5 ? 'var(--warning)' : '#fff' }}>
                      {(patient.Stage_2_Readmission_Risk * 100).toFixed(0)}<span style={{ fontSize: '1.25rem' }}>%</span>
                    </div>
                  </div>
                )}
              </div>

              {patient.Top_Risk_Drivers && patient.Top_Risk_Drivers.length > 0 && (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', background: 'var(--bg-dark)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)' }}>
                  <span style={{ color: 'var(--danger)', fontWeight: '600', marginRight: '0.5rem' }}>↑ Drivers:</span>
                  {patient.Top_Risk_Drivers[0].split(' (+')[0]}
                </div>
              )}
            </div>
          );
        })}
        {gridItems.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '5rem', color: 'var(--text-muted)' }}>
             No patients match your search.
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
              <Activity color="var(--primary)" /> Triage Pipeline
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

            {/* Severity Tabs */}
            <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--bg-dark)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              {['All', 'Severe', 'Moderate', 'Mild'].map(f => (
                <button 
                  key={f}
                  onClick={() => handleFilter(f)}
                  style={{
                    background: filter === f ? 'var(--primary-container)' : 'transparent',
                    color: filter === f ? '#fff' : 'var(--text-muted)',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: filter === f ? '600' : '500',
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

        {viewMode === 'grid' ? renderGridCards() : (
          <div style={{ overflowX: 'auto', flex: 1, position: 'relative' }}>
            <div style={{ padding: '0.5rem 1.5rem', background: 'var(--bg-dark)', borderBottom: '1px solid var(--border-light)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
               <strong>Pipeline Sorting Logic:</strong> Patients are systematically ordered <strong>Descending</strong> by baseline Stage 1 Admission Risk.
            </div>
            <table className="data-grid">
              <thead>
                <tr>
                  <th onClick={() => handleSort('Patient_ID')} style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>ID {getSortIcon('Patient_ID')}</div>
                  </th>
                  <th style={{ textAlign: 'center' }}>Demographics</th>
                  <th onClick={() => handleSort('Severity')} style={{ cursor: 'pointer', textAlign: 'center' }}>Severity</th>
                  <th onClick={() => handleSort('Stage_1_Admission_Risk')} style={{ cursor: 'pointer', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                      <TrendingUp size={14} /> Adm. Risk {getSortIcon('Stage_1_Admission_Risk')}
                    </div>
                  </th>
                  <th onClick={() => handleSort('Stage_2_Readmission_Risk')} style={{ cursor: 'pointer', textAlign: 'center' }}>
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
                  <tr key={`${patient.Patient_ID}-${idx}`} onClick={() => openSlideOut(patient)} className="clickable-row">
                    <td style={{ fontWeight: '600', color: 'var(--text-main)', paddingLeft: '1.5rem', fontFamily: 'Manrope, sans-serif' }}>{patient.Patient_ID}</td>
                    <td style={{ textAlign: 'center' }}>
                      {patient.Age} yrs • {patient.Sex}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${severityClass}`}>{patient.Severity}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="display-num">{(patient.Stage_1_Admission_Risk * 100).toFixed(1)}%</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {patient.Stage_2_Readmission_Risk !== null ? (
                        <span className="display-num" style={{ color: patient.Stage_2_Readmission_Risk > 0.5 ? 'var(--warning)' : 'var(--text-main)' }}>
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
                    <td colSpan="6" style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-muted)' }}>
                      <Search size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                      <br/>
                      No patients match your search parameter.
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
      />
    </>
  );
}
