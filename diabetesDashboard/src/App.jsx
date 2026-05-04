import React, { useState, useEffect } from 'react';
import PredictionsDirectory from './components/PredictionsDirectory';
import EDAView from './components/EDAView';
import { Stethoscope, Activity, BarChart2, AlertCircle, HelpCircle, X } from 'lucide-react';
import { EMPTY_FILTERS } from './filters';
import './index.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('eda');
  const [data, setData] = useState([]);
  // Canonical train-learned F1-max thresholds from machineLearning/models/thresholds.json.
  // Defaults are fallbacks only — replaced once the fetch resolves on first render.
  const [thresholds, setThresholds] = useState({ admission: 0.6873, readmission: 0.3394 });
  const [loading, setLoading] = useState(true);
  const [aboutOpen, setAboutOpen] = useState(false);
  // Cross-filter state lifted to App so EDAView (chart click handlers) and
  // PredictionsDirectory (severity tabs + drill-down landing) share one source.
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  useEffect(() => {
    Promise.all([
      fetch('/data/dashboard_payload.json').then(r => r.json()),
      fetch('/data/thresholds.json').then(r => r.ok ? r.json() : null)
    ])
      .then(([payload, thr]) => {
        setData(payload);
        if (thr && typeof thr.admission === 'number' && typeof thr.readmission === 'number') {
          setThresholds(thr);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load dashboard assets:", err);
        setLoading(false);
      });
  }, []);

  const updateFilters = (patch) => setFilters(f => ({ ...f, ...patch }));
  const clearAllFilters = () => setFilters(EMPTY_FILTERS);
  const onJumpToPredictions = () => setActiveTab('predictions');

  if (loading) {
    return (
      <div className="app-container">
        <div className="loading-screen">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <Activity color="var(--primary)" size={48} className="fast-spin" />
            <h2>Loading Full Cohort Predictions (62k+ patients)...</h2>
            <p style={{ color: 'var(--text-muted)' }}>Parsing machine learning inferences & SHAP values</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--primary), #a78bfa)',
            padding: '0.6rem',
            borderRadius: '12px',
            boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)'
          }}>
            <Stethoscope color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.35rem', margin: '0' }}>Clinical Data & Prediction Insights</h1>
            <p style={{ margin: '0', fontSize: '0.85rem' }}>Admission & Readmission Risk Explorer</p>
          </div>
        </div>

        <nav className="nav-links" style={{ padding: '0.5rem', background: 'var(--bg-surface)' }}>
          <button
            className={`nav-btn ${activeTab === 'eda' ? 'active' : ''}`}
            onClick={() => setActiveTab('eda')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.5rem' }}
          >
            <Activity size={16} /> Cohort Overview
          </button>
          <button
            className={`nav-btn ${activeTab === 'predictions' ? 'active' : ''}`}
            onClick={() => setActiveTab('predictions')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.5rem' }}
          >
            <BarChart2 size={16} /> Patient Predictions
          </button>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: '500' }}>Analyzed: {data.length.toLocaleString()} Profiles</span>
          <button
            type="button"
            onClick={() => setAboutOpen(true)}
            className="icon-btn"
            aria-label="About this model"
            title="About this model"
          >
            <HelpCircle size={18} />
          </button>
        </div>
      </header>

      <main className="main-content" style={{ padding: '3rem' }}>
        {data.length > 0 ? (
          activeTab === 'predictions'
            ? <PredictionsDirectory
                data={data}
                thresholds={thresholds}
                filters={filters}
                updateFilters={updateFilters}
                clearAllFilters={clearAllFilters}
              />
            : <EDAView
                data={data}
                thresholds={thresholds}
                filters={filters}
                updateFilters={updateFilters}
                clearAllFilters={clearAllFilters}
                onJumpToPredictions={onJumpToPredictions}
              />
        ) : (
          <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-muted)' }}>
            <AlertCircle size={48} color="var(--danger)" style={{ marginBottom: '1rem', opacity: 0.8 }} />
            <h2>No batch results available</h2>
            <p>Ensure the Python script has successfully written dashboard_payload.json</p>
          </div>
        )}
      </main>

      {/* About this model — methods note overlay */}
      {aboutOpen && (
        <div
          onClick={() => setAboutOpen(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(8px)',
            zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '2rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-model-heading"
            style={{
              background: 'var(--bg-card)', padding: '2.5rem', borderRadius: '1.25rem',
              maxWidth: '620px', width: '100%', maxHeight: '90vh', overflowY: 'auto',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--border-light)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 id="about-model-heading" style={{ margin: 0, fontSize: '1.5rem' }}>About This Model</h2>
              <button onClick={() => setAboutOpen(false)} className="icon-btn" aria-label="Close">
                <X size={20} />
              </button>
            </div>

            <div style={{ fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--text-main)' }}>
              <p style={{ marginBottom: '1rem' }}>
                <strong>Two-stage XGBoost.</strong> Predicts (1) hospital admission and (2) all-cause inpatient
                recurrence given admission. Both stages are gradient-boosted decision trees trained on a 62,135-patient
                Type-2 diabetes cohort drawn from a Malaysian third-party-administrator claims dataset.
              </p>
              <p style={{ marginBottom: '1rem' }}>
                <strong>22 features per patient</strong> — age, sex, clinical severity, ten medication classes, five
                diabetic complication flags, and counts of distinct diagnoses, medications, and clinical visits.
                Decision thresholds were optimised by maximising F1 on the training fold ({(thresholds.admission * 100).toFixed(1)}%
                admission, {(thresholds.readmission * 100).toFixed(1)}% readmission).
              </p>
              <p style={{ marginBottom: '1.25rem' }}>
                <strong>Performance.</strong> Admission ROC-AUC 0.865 (PR-AUC 0.534). Readmission ROC-AUC 0.876
                (PR-AUC 0.763); ablated to 0.813 / 0.605 when length-of-stay is removed.
              </p>

              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1.25rem' }}>
                <p style={{ marginBottom: '0.75rem' }}>
                  <strong>How to read this dashboard.</strong>
                </p>
                <ul style={{ paddingLeft: '1.25rem', marginBottom: 0, color: 'var(--text-main)' }}>
                  <li style={{ marginBottom: '0.6rem' }}>
                    <strong>Threshold.</strong> A patient is flagged for admission once their score reaches{' '}
                    {(thresholds.admission * 100).toFixed(1)}%. Bars and badges turn red above this point. The
                    histogram on the Cohort Overview tab shows the threshold as a dashed reference line.
                  </li>
                  <li style={{ marginBottom: '0.6rem' }}>
                    <strong>Cross-filter.</strong> Click any chart segment (age band, risk bin, severity cell) to
                    filter the entire dashboard. Active filters appear as removable chips and the "View N in
                    Predictions" button jumps to the patient list with the same filters applied.
                  </li>
                  <li>
                    <strong>SHAP explanations.</strong> The two charts on the SHAP panel show which features
                    pushed predictions up (red) or down (blue) — both averaged across the cohort and for
                    individual patients. Each patient's slideout drills into their personal driver breakdown.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
