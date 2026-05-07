import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as Tabs from '@radix-ui/react-tabs';
import { MotionConfig } from 'motion/react';
import { Toaster } from 'sonner';
import PredictionsDirectory from './components/PredictionsDirectory';
import EDAView from './components/EDAView';
import PatientSlideOut from './components/PatientSlideOut';
import CommandPalette from './components/CommandPalette';
import ShortcutsHelp from './components/ShortcutsHelp';
import { Stethoscope, Activity, BarChart2, AlertCircle, HelpCircle, X, Command as CommandIcon } from 'lucide-react';
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
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  // Cross-filter state lifted to App so EDAView (chart click handlers) and
  // PredictionsDirectory (severity tabs + drill-down landing) share one source.
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  // Patient slideout state lifted to App in Step 3 so the command palette can
  // open a patient from anywhere (any tab, any time).
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isSlideOpen, setIsSlideOpen] = useState(false);
  // Sibling list for arrow-key navigation in the slideout (Step 5). Empty when
  // opened from the command palette (no row context); populated by
  // PredictionsDirectory when opened from a row click.
  const [siblings, setSiblings] = useState([]);

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
  const onJumpToEDA = () => setActiveTab('eda');
  const openSlideOut = (patient, sibs = []) => {
    setSelectedPatient(patient);
    setSiblings(sibs);
    setIsSlideOpen(true);
  };
  const closeSlideOut = () => setIsSlideOpen(false);

  // O(1) patient lookup map for slideout sibling navigation.
  const patientLookup = useMemo(() => {
    const m = new Map();
    data.forEach(p => m.set(p.Patient_ID, p));
    return m;
  }, [data]);

  const navigateSlideOut = useCallback((direction) => {
    if (!selectedPatient || siblings.length < 2) return;
    const idx = siblings.indexOf(selectedPatient.Patient_ID);
    if (idx === -1) return;
    const len = siblings.length;
    const nextIdx = direction === 'next'
      ? (idx + 1) % len
      : (idx - 1 + len) % len;
    const next = patientLookup.get(siblings[nextIdx]);
    if (next) setSelectedPatient(next);
  }, [selectedPatient, siblings, patientLookup]);

  // Global keyboard shortcuts: Cmd/Ctrl+K opens palette; Cmd/Ctrl+1/2 jumps
  // tabs; ? opens shortcuts help (suppressed when typing in inputs/textareas).
  useEffect(() => {
    const onKey = (e) => {
      const target = e.target;
      const inEditable = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setPaletteOpen(o => !o);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '1') {
        e.preventDefault();
        setActiveTab('eda');
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '2') {
        e.preventDefault();
        setActiveTab('predictions');
        return;
      }
      if (e.key === '?' && !inEditable && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setShortcutsOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (loading) {
    return (
      <MotionConfig reducedMotion="user">
      <Tooltip.Provider delayDuration={150}>
        <div className="app-container">
          <div className="loading-screen">
            <div className="loading-stack">
              <Activity color="var(--primary)" size={48} className="fast-spin" />
              <h2>Loading Full Cohort Predictions (61k patients)...</h2>
              <p>Parsing machine learning inferences & SHAP values</p>
            </div>
          </div>
        </div>
        <Toaster richColors position="bottom-right" theme="light" />
      </Tooltip.Provider>
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
    <Tooltip.Provider delayDuration={150}>
    <Tabs.Root value={activeTab} onValueChange={setActiveTab} asChild>
      <div className="app-container">
        <header className="header">
          <div className="icon-row">
            <div className="brand-tile">
              <Stethoscope color="white" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.35rem', margin: '0' }}>DART</h1>
              <p style={{ margin: '0', fontSize: '0.85rem' }}>Diabetic Admission Readmission Tool</p>
            </div>
          </div>

          <Tabs.List asChild>
            <nav className="nav-links">
              <Tabs.Trigger value="eda" className="nav-btn">
                <Activity size={16} /> Cohort Overview
              </Tabs.Trigger>
              <Tabs.Trigger value="predictions" className="nav-btn">
                <BarChart2 size={16} /> Patient Predictions
              </Tabs.Trigger>
            </nav>
          </Tabs.List>

          <div className="icon-row">
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: '500' }}>Analyzed: {data.length.toLocaleString()} Profiles</span>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="header-cmd-hint"
              aria-label="Open command palette (Ctrl+K)"
              title="Open command palette (Ctrl+K)"
            >
              <CommandIcon size={14} /> <span>K</span>
            </button>
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

        <main className="main-content">
          {data.length > 0 ? (
            <>
              <Tabs.Content value="eda" className="tab-panel">
                <EDAView
                  data={data}
                  thresholds={thresholds}
                  filters={filters}
                  updateFilters={updateFilters}
                  clearAllFilters={clearAllFilters}
                  onJumpToPredictions={onJumpToPredictions}
                />
              </Tabs.Content>
              <Tabs.Content value="predictions" className="tab-panel">
                <PredictionsDirectory
                  data={data}
                  thresholds={thresholds}
                  filters={filters}
                  updateFilters={updateFilters}
                  clearAllFilters={clearAllFilters}
                  onJumpToEDA={onJumpToEDA}
                  openSlideOut={openSlideOut}
                />
              </Tabs.Content>
            </>
          ) : (
            <div className="empty-fallback">
              <AlertCircle size={48} color="var(--danger)" className="empty-fallback__icon" />
              <h2>No batch results available</h2>
              <p>Ensure the Python script has successfully written dashboard_payload.json</p>
            </div>
          )}
        </main>
      </div>
    </Tabs.Root>

      {/* About this model — methods note overlay (Radix Dialog).
          Replaced the hand-rolled backdrop / click-outside / focus-trap with
          Radix's primitives. Esc, focus return, scroll lock all built in. */}
      <Dialog.Root open={aboutOpen} onOpenChange={setAboutOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="radix-dialog-overlay" />
          <Dialog.Content className="radix-dialog-content" aria-describedby={undefined}>
            <div className="dialog-header">
              <Dialog.Title asChild>
                <h2 className="dialog-h2">About This Model</h2>
              </Dialog.Title>
              <Dialog.Close asChild>
                <button className="icon-btn" aria-label="Close">
                  <X size={20} />
                </button>
              </Dialog.Close>
            </div>

            <div className="dialog-body">
              <p>
                <strong>Two-stage XGBoost.</strong> Predicts (1) hospital admission and (2) all-cause inpatient
                recurrence given admission. Both stages are gradient-boosted decision trees trained on a 61,406-patient
                Type-2 diabetes cohort drawn from a Malaysian third-party-administrator claims dataset.
              </p>
              <p>
                <strong>22 features per patient</strong> — age, sex, clinical severity, ten medication classes, five
                diabetic complication flags, and counts of distinct diagnoses, medications, and clinical visits.
                Decision thresholds were optimised by maximising F1 on the training fold ({(thresholds.admission * 100).toFixed(1)}%
                admission, {(thresholds.readmission * 100).toFixed(1)}% readmission).
              </p>
              <p>
                <strong>Performance.</strong> Admission ROC-AUC 0.865 (PR-AUC 0.534). Readmission ROC-AUC 0.876
                (PR-AUC 0.763); ablated to 0.813 / 0.605 when length-of-stay is removed.
              </p>

              <div className="dialog-section-divider">
                <p><strong>How to read this dashboard.</strong></p>
                <ul>
                  <li>
                    <strong>Threshold.</strong> A patient is flagged for admission once their score reaches{' '}
                    {(thresholds.admission * 100).toFixed(1)}%. Bars and badges turn red above this point. The
                    histogram on the Cohort Overview tab shows the threshold as a dashed reference line.
                  </li>
                  <li>
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
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <PatientSlideOut
        patient={selectedPatient}
        isOpen={isSlideOpen}
        onClose={closeSlideOut}
        thresholds={thresholds}
        data={data}
        siblings={siblings}
        onNavigate={navigateSlideOut}
      />

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        data={data}
        setActiveTab={setActiveTab}
        setFilters={setFilters}
        clearAllFilters={clearAllFilters}
        openSlideOut={openSlideOut}
        slideoutOpen={isSlideOpen}
        onSlideoutClose={closeSlideOut}
      />

      <ShortcutsHelp open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

      <Toaster richColors position="bottom-right" theme="light" />
    </Tooltip.Provider>
    </MotionConfig>
  );
}
