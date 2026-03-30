import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, AlertCircle, TrendingUp, Activity, ChevronLeft, ChevronRight } from 'lucide-react';

export default function PredictionsDirectory({ data, onSelectPatient }) {
  const [filter, setFilter] = useState('All');
  const [sortField, setSortField] = useState('Stage_1_Admission_Risk');
  const [sortDesc, setSortDesc] = useState(true);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Process filtering and sorting efficiently using useMemo
  const processedData = useMemo(() => {
    let result = data;
    if (filter !== 'All') {
      result = result.filter(d => d.Severity === filter);
    }
    
    // Create shallow copy to sort safely
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
  }, [data, filter, sortField, sortDesc]);

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

  const getSortIcon = (field) => {
    if (sortField !== field) return null;
    return sortDesc ? <ChevronDown size={14} /> : <ChevronUp size={14} />;
  };

  return (
    <div className="glass-card" style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity color="var(--primary)" /> ML Predictions Directory
          </h2>
          <p style={{ marginTop: '0.25rem', fontSize: '0.9rem' }}>Full Batch Analysis: Showing {processedData.length.toLocaleString()} patients</p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.25rem', borderRadius: '8px' }}>
          {['All', 'Severe', 'Moderate', 'Mild'].map(f => (
            <button 
              key={f}
              onClick={() => handleFilter(f)}
              style={{
                background: filter === f ? 'var(--primary)' : 'transparent',
                color: filter === f ? '#fff' : 'var(--text-muted)',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: filter === f ? '600' : '400',
                transition: 'var(--transition)'
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div style={{ overflowX: 'auto', flex: 1 }}>
        <table className="data-grid">
          <thead>
            <tr>
              <th onClick={() => handleSort('Patient_ID')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>ID {getSortIcon('Patient_ID')}</div>
              </th>
              <th>Demographics</th>
              <th onClick={() => handleSort('Severity')} style={{ cursor: 'pointer' }}>Severity</th>
              <th onClick={() => handleSort('Stage_1_Admission_Risk')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <TrendingUp size={14} /> Admission Risk {getSortIcon('Stage_1_Admission_Risk')}
                </div>
              </th>
              <th onClick={() => handleSort('Stage_2_Readmission_Risk')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                   Readmission Risk {getSortIcon('Stage_2_Readmission_Risk')}
                </div>
              </th>
              <th>Primary Driver (SHAP)</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.map((patient, idx) => {
              const severityColor = patient.Severity === 'Severe' ? 'critical' : 
                                    patient.Severity === 'Moderate' ? 'high' : 'low';
                                    
              return (
              <tr key={idx} onClick={() => onSelectPatient(patient)}>
                <td style={{ fontWeight: '600', color: 'var(--text-main)', paddingLeft: '1.5rem' }}>{patient.Patient_ID}</td>
                <td>
                  {patient.Age} yrs • {patient.Sex}
                </td>
                <td>
                  <span className={`badge ${severityColor}`}>{patient.Severity}</span>
                </td>
                <td>
                  <span style={{ fontWeight: '600' }}>{(patient.Stage_1_Admission_Risk * 100).toFixed(1)}%</span>
                </td>
                <td>
                  {patient.Stage_2_Readmission_Risk !== null ? (
                    <span style={{ color: patient.Stage_2_Readmission_Risk > 0.5 ? 'var(--warning)' : 'var(--text-main)' }}>
                       {(patient.Stage_2_Readmission_Risk * 100).toFixed(1)}%
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>N/A (No admission predicted)</span>
                  )}
                </td>
                <td>
                  {patient.Top_Risk_Drivers && patient.Top_Risk_Drivers.length > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fca5a5', fontSize: '0.9rem' }}>
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
                <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No patients match the current filters in the dataset.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ 
          padding: '1rem 1.5rem', 
          borderTop: '1px solid var(--border-light)', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          background: 'rgba(0,0,0,0.1)',
          borderBottomLeftRadius: '16px',
          borderBottomRightRadius: '16px'
        }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Showing {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, processedData.length)} of {processedData.length.toLocaleString()} patients
          </span>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button 
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-light)', color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-main)', padding: '0.5rem', borderRadius: '8px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: '0.9rem', margin: '0 0.5rem' }}>Page {currentPage} of {totalPages.toLocaleString()}</span>
            <button 
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-light)', color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-main)', padding: '0.5rem', borderRadius: '8px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
