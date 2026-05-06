import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, User, Activity, AlertCircle, AlertTriangle, HeartPulse, Flame, CircleDot, Wrench, Lock } from 'lucide-react';
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
      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{label}</span>
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
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>{context}</div>
    )}
    {suppressed && suppressedText && (
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>{suppressedText}</div>
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

export default function PatientSlideOut({ patient, isOpen, onClose, thresholds, data = [] }) {
  const panelRef = useRef(null);
  const previousFocusRef = useRef(null);
  const [activeDriverTab, setActiveDriverTab] = useState('admission');
  const tips = useMemo(() => getTips(thresholds), [thresholds]);

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

  // Cohort-baseline percentages used by the comparison block in the drivers
  // section: what fraction of the relevant population the model flags positive.
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

  // Escape to close + Tab focus trap. On open, snapshot the previously focused
  // element and move focus into the panel; on close, restore it.
  useEffect(() => {
    if (!isOpen) return undefined;
    previousFocusRef.current = document.activeElement;

    const focusTimer = setTimeout(() => {
      const focusables = panelRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusables?.[0]?.focus();
    }, 50);

    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = panelRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKey);
      previousFocusRef.current?.focus?.();
    };
  }, [isOpen, onClose]);

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
    <>
      <div
        className={`slide-backdrop ${isOpen ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        className={`slide-panel ${isOpen ? 'open' : ''}`}
        role="dialog"
        aria-modal={isOpen ? 'true' : undefined}
        aria-hidden={!isOpen}
        inert={!isOpen ? true : undefined}
        aria-label={patient ? `Patient record ${patient.Patient_ID}` : 'Patient record'}
        aria-describedby={patient ? 'slideout-patient-heading' : undefined}
      >
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             Patient Record
          </h2>
          <button onClick={onClose} className="icon-btn" aria-label="Close patient record">
            <X size={20} />
          </button>
        </div>

        {patient && (
          <div style={{ padding: '1.5rem', overflowY: 'auto', height: 'calc(100vh - 80px)' }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '2rem' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 25px ${severityColor}44`, border: `2px solid ${severityColor}aa` }}>
                <User size={30} color={severityColor} />
              </div>
              <div>
                <h1 id="slideout-patient-heading" style={{ fontSize: '1.75rem', marginBottom: '0.2rem' }}>{patient.Patient_ID}</h1>
                <p style={{ margin: '0', color: 'var(--text-muted)' }}>{patient.Age} yrs • {patient.Sex}</p>
                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span className={`badge ${patient.Severity.toLowerCase()}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <SeverityIcon severity={patient.Severity} size={12} />
                    {patient.Severity} Risk Profile
                  </span>
                  <InfoTip text={tips.severity_logic.text} size={12} />
                </div>
              </div>
            </div>

            <h3 style={{ paddingBottom: '0.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontFamily: 'Manrope, sans-serif' }}>
              <Activity size={18} color="var(--primary)" /> Predicted Probabilities
            </h3>
            <div style={{ background: 'var(--bg-surface-high)', padding: '1.25rem', borderRadius: '1rem', border: '1px solid var(--border-light)', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
              <div className="stat-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="label">Admission Risk</span>
                  <Activity size={16} color="var(--primary)" />
                </div>
                <div className="value" style={{ color: admissionFlagged ? 'var(--danger)' : 'var(--text-main)' }}>
                  {(admissionRisk * 100).toFixed(1)}%
                </div>
              </div>

              <div className="stat-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="label">Readmission Exp.</span>
                  <HeartPulse size={16} color="var(--warning)" />
                </div>
                <div className="value">
                  {readmissionRisk !== null ?
                    <span style={{ color: readmissionFlagged ? 'var(--warning)' : 'var(--text-main)' }}>{(readmissionRisk * 100).toFixed(1)}%</span> :
                    <span style={{ fontSize: '1rem', fontWeight: '400', color: 'var(--text-muted)' }}>N/A</span>
                  }
                </div>
              </div>
            </div>

            {/* Primary Predictive Drivers — admission/readmission tabs */}
            <h3 style={{ paddingBottom: '0.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontFamily: 'Manrope, sans-serif' }}>
              <AlertCircle size={18} color="var(--danger)" /> Primary Predictive Drivers
              <InfoTip
                text={activeDriverTab === 'admission' ? tips.patient_admission_drivers.text : tips.patient_readmission_drivers.text}
                size={14}
              />
            </h3>

            <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-dark)', padding: '0.4rem', borderRadius: '12px', border: '1px solid var(--border-light)', marginBottom: '1rem' }}>
              <button
                onClick={() => setActiveDriverTab('admission')}
                style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', border: 'none', background: activeDriverTab === 'admission' ? 'var(--bg-surface-high)' : 'transparent', color: activeDriverTab === 'admission' ? '#fff' : 'var(--text-muted)', fontWeight: activeDriverTab === 'admission' ? '600' : '500', transition: 'var(--transition)' }}
              >
                Admission
              </button>
              <button
                onClick={() => setActiveDriverTab('readmission')}
                style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', border: 'none', background: activeDriverTab === 'readmission' ? 'var(--bg-surface-high)' : 'transparent', color: activeDriverTab === 'readmission' ? '#fff' : 'var(--text-muted)', fontWeight: activeDriverTab === 'readmission' ? '600' : '500', transition: 'var(--transition)' }}
              >
                Readmission
              </button>
            </div>

            {/* Cohort baseline comparison — answers "is this patient unusual?".
                Hidden on the readmission tab when Stage 2 wasn't predicted. */}
            {!(activeDriverTab === 'readmission' && readmissionUnavailable) && (() => {
              const patientPct = activeDriverTab === 'admission'
                ? admissionRisk * 100
                : (readmissionRisk || 0) * 100;
              const baselinePct = activeDriverTab === 'admission'
                ? globalAdmissionFlaggedPct
                : globalReadmissionFlaggedPct;
              const delta = patientPct - baselinePct;
              const above = delta >= 0;
              return (
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '0.75rem',
                  padding: '0.85rem 1rem',
                  marginBottom: '1rem',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem' }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                        This patient
                      </div>
                      <div style={{ fontSize: '1.4rem', fontFamily: 'Manrope, sans-serif', fontWeight: 700, color: 'var(--text-main)' }}>
                        {patientPct.toFixed(1)}<span style={{ fontSize: '0.5em', marginLeft: '0.1em' }}>%</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                        Cohort baseline
                      </div>
                      <div style={{ fontSize: '1.4rem', fontFamily: 'Manrope, sans-serif', fontWeight: 700, color: 'var(--text-muted)' }}>
                        {baselinePct.toFixed(1)}<span style={{ fontSize: '0.5em', marginLeft: '0.1em' }}>%</span>
                      </div>
                    </div>
                  </div>
                  <div style={{
                    marginTop: '0.6rem',
                    paddingTop: '0.55rem',
                    borderTop: '1px solid var(--border-light)',
                    fontSize: '0.78rem',
                    color: above ? 'var(--danger)' : 'var(--success)',
                    fontWeight: 600,
                  }}>
                    {above ? '↑' : '↓'} {Math.abs(delta).toFixed(1)} points {above ? 'above' : 'below'} baseline
                  </div>
                </div>
              );
            })()}

            <div style={{ background: 'var(--bg-surface-high)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-light)' }}>
              {activeDriverTab === 'readmission' && readmissionUnavailable ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Readmission not predicted for this patient — Stage 1 admission score is below the model threshold.
                </div>
              ) : activeDriverTab === 'readmission' && readmissionDriversNotYetGenerated ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
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
                        <Bar dataKey="impact" radius={[0, 4, 4, 0]} barSize={20}>
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
                  <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>
                      Action context
                      <InfoTip text={tips.modifiable_drivers.text} size={11} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {activeDrivers.map(d => {
                        const modifiable = isModifiable(d.name);
                        return (
                          <div
                            key={d.name}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '0.5rem',
                              fontSize: '0.82rem',
                              padding: '0.45rem 0.65rem',
                              borderRadius: '0.45rem',
                              background: 'var(--bg-card)',
                              border: '1px solid var(--border-light)',
                            }}
                          >
                            <span style={{ color: 'var(--text-main)' }}>{d.label}</span>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                              fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                              padding: '0.2rem 0.55rem', borderRadius: '999px',
                              background: modifiable ? 'var(--success-container)' : 'var(--bg-surface-high)',
                              color: modifiable ? 'var(--success)' : 'var(--text-muted)',
                            }}>
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
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  {activeDriverTab === 'admission' && patient.Predicted_Admission === 1
                    ? 'Detailed SHAP drivers not strongly skewed for this patient.'
                    : 'No strong drivers identified for this patient.'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
