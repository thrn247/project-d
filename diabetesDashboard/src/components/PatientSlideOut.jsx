import React, { useEffect, useMemo, useState } from 'react';
import { Drawer } from 'vaul';
import {
  X, User, Activity, AlertCircle, AlertTriangle, Flame, CircleDot,
  Wrench, Lock, ArrowLeft, ArrowRight,
} from 'lucide-react';

// Responsive direction for vaul: slides from the right on desktop (≥1024px),
// from the bottom on mobile/tablet. vaul's `direction` is a static prop, so
// we drive it with a matchMedia listener.
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(min-width: 1024px)').matches
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mql = window.matchMedia('(min-width: 1024px)');
    const handler = (e) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Cell } from 'recharts';
import { labelFor, isModifiable } from '../featureLabels';
import InfoTip from './InfoTip';
import { getTips } from '../copy';

const SEVERITY_ICON_MAP = { Severe: Flame, Moderate: AlertTriangle, Mild: CircleDot };
const SeverityIcon = ({ severity, size = 14 }) => {
  const Icon = SEVERITY_ICON_MAP[severity];
  return Icon ? <Icon size={size} /> : null;
};

const ProbBar = ({ label, value, color, threshold, context, suppressed = false, suppressedText = '' }) => (
  <div style={{ opacity: suppressed ? 0.6 : 1 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', alignItems: 'baseline' }}>
      <span className="text-eyebrow">{label}</span>
      <span style={{ fontSize: '1.05rem', fontFamily: 'Manrope, sans-serif', fontWeight: 700, color: suppressed ? 'var(--text-muted)' : color }}>
        {suppressed ? '—' : `${value.toFixed(1)}%`}
      </span>
    </div>
    <div style={{ position: 'relative' }}>
      <div style={{ height: '12px', background: 'var(--bg-surface-high)', borderRadius: '999px', overflow: 'hidden', position: 'relative' }}>
        {!suppressed && (
          <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, value))}%`, background: color, borderRadius: '999px', transition: 'width 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)' }} />
        )}
      </div>
      {/* Subtle vertical tick at the model threshold — visual reinforcement of where
          the cutoff sits without putting the numeric value on the chart. */}
      {threshold !== undefined && !suppressed && (
        <div
          style={{
            position: 'absolute',
            top: '-3px',
            bottom: '-3px',
            left: `${threshold}%`,
            width: '2px',
            background: 'var(--text-main)',
            opacity: 0.45,
            pointerEvents: 'none',
          }}
          title={`Model threshold: ${threshold.toFixed(1)}%`}
          aria-hidden="true"
        />
      )}
    </div>
    {context && !suppressed && (
      <div className="probbar-caption">{context}</div>
    )}
    {suppressed && suppressedText && (
      <div className="probbar-caption">{suppressedText}</div>
    )}
  </div>
);

// Parse "FEATURE_NAME (+XX.X%)" strings from the payload into chart-ready rows,
// with clinical labels via the shared featureLabels map.
const parseDrivers = (driverStrings) => {
  if (!driverStrings || !Array.isArray(driverStrings)) return [];
  const out = [];
  driverStrings.forEach(driver => {
    const parts = driver.split(' (+');
    if (parts.length === 2) {
      const name = parts[0];
      out.push({
        name,
        label: labelFor(name),
        impact: parseFloat(parts[1].replace('%)', ''))
      });
    }
  });
  return out;
};

// Binary search for percentile: how many cohort scores fall below `value`,
// expressed as a percentage of the cohort.
const computePercentile = (sortedArr, value) => {
  if (!sortedArr || sortedArr.length === 0 || value == null) return null;
  let lo = 0;
  let hi = sortedArr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sortedArr[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return (lo / sortedArr.length) * 100;
};

// Cohort-baseline mini-card. Shows patient % vs cohort baseline % side-by-side
// with a directional delta. Step 5 promoted this out of the drivers section so
// both admission and readmission baselines render together up top.
function BaselineCard({ heading, patientPct, baselinePct }) {
  const delta = patientPct - baselinePct;
  const above = delta >= 0;
  return (
    <div className="baseline-card">
      <div className="baseline-card__heading">{heading}</div>
      <div className="baseline-card__row">
        <div>
          <div className="baseline-card__label">This patient</div>
          <div className="baseline-card__value">
            {patientPct.toFixed(1)}<span className="kpi-pct-suffix">%</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="baseline-card__label">Cohort baseline</div>
          <div className="baseline-card__value baseline-card__value--muted">
            {baselinePct.toFixed(1)}<span className="kpi-pct-suffix">%</span>
          </div>
        </div>
      </div>
      <div className={`baseline-card__delta ${above ? 'above' : 'below'}`}>
        {above ? '↑' : '↓'} {Math.abs(delta).toFixed(1)} points {above ? 'above' : 'below'} baseline
      </div>
    </div>
  );
}

export default function PatientSlideOut({
  patient,
  isOpen,
  onClose,
  thresholds,
  data = [],
  siblings = [],
  onNavigate,
}) {
  const [activeDriverTab, setActiveDriverTab] = useState('admission');
  const tips = useMemo(() => getTips(thresholds), [thresholds]);
  const isDesktop = useIsDesktop();

  // Pre-sort cohort risk scores once; used for percentile lookups when patients change.
  const sortedAdmissionRisks = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return [];
    return data.map(d => d.Stage_1_Admission_Risk || 0).sort((a, b) => a - b);
  }, [data]);

  const sortedReadmissionRisks = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return [];
    return data
      .filter(d => d.Stage_2_Readmission_Risk !== null && d.Stage_2_Readmission_Risk !== undefined)
      .map(d => d.Stage_2_Readmission_Risk)
      .sort((a, b) => a - b);
  }, [data]);

  // Cohort-baseline percentages: what fraction of the relevant population the
  // model flags positive.
  const globalAdmissionFlaggedPct = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return 0;
    return (data.filter(d => d.Predicted_Admission === 1).length / data.length) * 100;
  }, [data]);

  const globalReadmissionFlaggedPct = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return 0;
    const admitted = data.filter(d => d.Stage_2_Readmission_Risk !== null && d.Stage_2_Readmission_Risk !== undefined);
    if (admitted.length === 0) return 0;
    return (admitted.filter(d => d.Stage_2_Readmission_Risk >= thresholds.readmission).length / admitted.length) * 100;
  }, [data, thresholds]);

  // Sibling navigation: enabled when we have ≥2 IDs and the current patient
  // appears in the list (defensive — palette opens with siblings = [] so nav is
  // disabled in that case).
  const canNavigate = Boolean(
    onNavigate && siblings.length >= 2 && patient && siblings.includes(patient.Patient_ID)
  );

  // ←/→ keyboard nav, suppressed when typing in inputs/textareas/contentEditable.
  useEffect(() => {
    if (!isOpen || !canNavigate) return undefined;
    const onKey = (e) => {
      const target = e.target;
      const inEditable = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );
      if (inEditable) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onNavigate('prev');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onNavigate('next');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, canNavigate, onNavigate]);

  const admissionDrivers = parseDrivers(patient?.Top_Risk_Drivers);
  const readmissionDrivers = parseDrivers(patient?.Top_Readmission_Drivers);
  const activeDrivers = activeDriverTab === 'admission' ? admissionDrivers : readmissionDrivers;

  const severityColor = patient?.Severity === 'Severe' ? 'var(--danger)' :
                       patient?.Severity === 'Moderate' ? 'var(--warning)' : 'var(--success)';

  const admissionRisk = patient ? patient.Stage_1_Admission_Risk : 0;
  const readmissionRisk = patient ? patient.Stage_2_Readmission_Risk : null;
  const admissionFlagged = patient ? admissionRisk >= thresholds.admission : false;
  const readmissionFlagged = readmissionRisk !== null && readmissionRisk >= thresholds.readmission;
  const admissionBarColor = admissionFlagged ? 'var(--danger)' : 'var(--primary)';
  const readmissionBarColor = readmissionFlagged ? 'var(--warning)' : 'var(--primary)';

  const admissionPercentile = useMemo(() => {
    if (!patient) return null;
    return computePercentile(sortedAdmissionRisks, patient.Stage_1_Admission_Risk);
  }, [patient, sortedAdmissionRisks]);

  const readmissionPercentile = useMemo(() => {
    if (!patient || patient.Stage_2_Readmission_Risk === null) return null;
    return computePercentile(sortedReadmissionRisks, patient.Stage_2_Readmission_Risk);
  }, [patient, sortedReadmissionRisks]);

  const readmissionUnavailable = readmissionRisk === null;
  const readmissionDriversNotYetGenerated =
    !readmissionUnavailable && (patient?.Top_Readmission_Drivers === undefined);

  return (
    <Drawer.Root
      open={isOpen}
      onOpenChange={(o) => { if (!o) onClose(); }}
      direction={isDesktop ? 'right' : 'bottom'}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="radix-dialog-overlay" />
        <Drawer.Content className="slideout-panel" aria-describedby={undefined}>
          {/* Top bar — title, sibling nav, close. Pinned at top of panel. */}
          <div className="slideout-header">
            <Drawer.Title asChild>
              <h2 className="slideout-title">Patient Record</h2>
            </Drawer.Title>
            <div className="slideout-actions">
              {canNavigate && (
                <>
                  <button
                    type="button"
                    onClick={() => onNavigate('prev')}
                    className="icon-btn"
                    aria-label="Previous patient"
                    title="Previous patient (←)"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('next')}
                    className="icon-btn"
                    aria-label="Next patient"
                    title="Next patient (→)"
                  >
                    <ArrowRight size={16} />
                  </button>
                </>
              )}
              <Drawer.Close asChild>
                <button className="icon-btn" aria-label="Close patient record">
                  <X size={20} />
                </button>
              </Drawer.Close>
            </div>
          </div>

          {patient && (
            <div className="slideout-body">
              <div className="patient-header">
                <div
                  className="patient-header__avatar"
                  style={{ boxShadow: `0 0 25px ${severityColor}44`, border: `2px solid ${severityColor}aa` }}
                >
                  <User size={30} color={severityColor} />
                </div>
                <div>
                  <h1 id="slideout-patient-heading" className="patient-header__name">{patient.Patient_ID}</h1>
                  <p style={{ margin: 0 }}>{patient.Age} yrs • {patient.Sex}</p>
                  <div className="patient-header__badge-row">
                    <span className={`badge ${patient.Severity.toLowerCase()} icon-row-xs`}>
                      <SeverityIcon severity={patient.Severity} size={12} />
                      {patient.Severity} Risk Profile
                    </span>
                    <InfoTip text={tips.severity_logic.text} size={12} />
                  </div>
                  {canNavigate && (
                    <div className="patient-header__sibling-pos">
                      {(siblings.indexOf(patient.Patient_ID) + 1).toLocaleString()} of {siblings.length.toLocaleString()} in current view
                    </div>
                  )}
                </div>
              </div>

              <h3 className="section-h3">
                <Activity size={18} color="var(--primary)" /> Predicted Probabilities
              </h3>
              <div className="probability-card">
                <ProbBar
                  label="Admission probability"
                  value={admissionRisk * 100}
                  color={admissionBarColor}
                  threshold={thresholds.admission * 100}
                  context={admissionPercentile != null ? `Higher than ${admissionPercentile.toFixed(0)}% of all ${data.length.toLocaleString()} patients` : null}
                />
                <ProbBar
                  label="Readmission probability"
                  value={readmissionRisk !== null ? readmissionRisk * 100 : 0}
                  color={readmissionBarColor}
                  threshold={readmissionRisk !== null ? thresholds.readmission * 100 : undefined}
                  context={readmissionPercentile != null ? `Higher than ${readmissionPercentile.toFixed(0)}% of admitted patients` : null}
                  suppressed={readmissionRisk === null}
                  suppressedText="Not predicted (patient flagged low admission risk)"
                />
              </div>

              {/* Cohort Baseline section — promoted out of the drivers section
                  in step 5 so both admission + readmission baselines are
                  visible at a glance, not gated by the active driver tab. */}
              <h3 className="section-h3">
                <AlertTriangle size={18} color="var(--warning)" /> Cohort Baseline
              </h3>
              <div className={`cohort-baseline-grid ${readmissionUnavailable ? 'single' : ''}`} style={{ marginBottom: '2rem' }}>
                <BaselineCard
                  heading="Admission"
                  patientPct={admissionRisk * 100}
                  baselinePct={globalAdmissionFlaggedPct}
                />
                {!readmissionUnavailable && (
                  <BaselineCard
                    heading="Readmission"
                    patientPct={(readmissionRisk || 0) * 100}
                    baselinePct={globalReadmissionFlaggedPct}
                  />
                )}
              </div>

              {/* Primary Predictive Drivers — admission/readmission tabs */}
              <h3 className="section-h3">
                <AlertCircle size={18} color="var(--danger)" /> Primary Predictive Drivers
                <InfoTip
                  text={activeDriverTab === 'admission' ? tips.patient_admission_drivers.text : tips.patient_readmission_drivers.text}
                  size={14}
                />
              </h3>

              <div className="toggle-strip">
                <button
                  type="button"
                  onClick={() => setActiveDriverTab('admission')}
                  className="toggle-strip__btn"
                  aria-pressed={activeDriverTab === 'admission'}
                >
                  Admission
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDriverTab('readmission')}
                  className="toggle-strip__btn"
                  aria-pressed={activeDriverTab === 'readmission'}
                >
                  Readmission
                </button>
              </div>

              <div className="surface-card--inner">
                {activeDriverTab === 'readmission' && readmissionUnavailable ? (
                  <div className="empty-message">
                    Readmission not predicted for this patient — Stage 1 admission score is below the model threshold.
                  </div>
                ) : activeDriverTab === 'readmission' && readmissionDriversNotYetGenerated ? (
                  <div className="empty-message">
                    Per-patient readmission drivers not available in this payload — re-run <code>build_export.py</code> to generate them.
                  </div>
                ) : activeDrivers.length > 0 ? (
                  <>
                    <div style={{ height: '300px', width: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={activeDrivers}
                          layout="vertical"
                          margin={{ top: 0, right: 30, left: 10, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-light)" />
                          <XAxis type="number" tickFormatter={(value) => `${value}%`} stroke="var(--text-muted)" fontSize={11} axisLine={false} tickLine={false} />
                          <YAxis dataKey="label" type="category" width={220} tick={{ fill: 'var(--text-main)', fontSize: '0.75rem' }} axisLine={false} tickLine={false} />
                          <Tooltip
                            cursor={{ fill: 'var(--border-light)' }}
                            formatter={(value) => [`+${value.toFixed(1)}% Impact`, 'Contribution to risk']}
                          />
                          <Bar dataKey="impact" radius={[0, 4, 4, 0]} barSize={20} animationDuration={400}>
                            {activeDrivers.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={'url(#patientDriverGradient)'} />
                            ))}
                          </Bar>
                          <defs>
                            <linearGradient id="patientDriverGradient" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="var(--warning)" stopOpacity={0.7} />
                              <stop offset="100%" stopColor="var(--danger)" stopOpacity={1} />
                            </linearGradient>
                          </defs>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Action context — modifiable vs intrinsic per driver */}
                    <div className="action-context-divider">
                      <div className="text-eyebrow--sm action-context-label">
                        Action context
                        <InfoTip text={tips.modifiable_drivers.text} size={11} />
                      </div>
                      <div className="col-gap-sm">
                        {activeDrivers.map(d => {
                          const modifiable = isModifiable(d.name);
                          return (
                            <div key={d.name} className="action-row">
                              <span>{d.label}</span>
                              <span
                                className="action-pill"
                                style={{
                                  background: modifiable ? 'var(--success-container)' : 'var(--bg-surface-high)',
                                  color: modifiable ? 'var(--success)' : 'var(--text-muted)',
                                }}
                              >
                                {modifiable ? <Wrench size={10} /> : <Lock size={10} />}
                                {modifiable ? 'Modifiable' : 'Intrinsic'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="empty-message">
                    {activeDriverTab === 'admission' && patient.Predicted_Admission === 1
                      ? 'Detailed SHAP drivers not strongly skewed for this patient.'
                      : 'No strong drivers identified for this patient.'}
                  </div>
                )}
              </div>
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
