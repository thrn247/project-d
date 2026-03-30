import React, { useEffect, useState } from 'react';
import { X, User, Activity, AlertCircle, FileText, HeartPulse } from 'lucide-react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Cell, AreaChart, Area } from 'recharts';

export default function PatientSlideOut({ patient, isOpen, onClose }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
    } else {
      setTimeout(() => setMounted(false), 300); // Wait for transition
    }
  }, [isOpen]);

  if (!mounted && !isOpen) return null;

  // Prepare SHAP Data for chart
  const shapData = [];
  if (patient?.Top_Risk_Drivers && patient.Top_Risk_Drivers.length > 0) {
    patient.Top_Risk_Drivers.forEach(driver => {
      const parts = driver.split(' (+');
      if (parts.length === 2) {
        shapData.push({
          name: parts[0],
          impact: parseFloat(parts[1].replace('%)', ''))
        });
      }
    });
  }

  const severityColor = patient?.Severity === 'Severe' ? 'var(--danger)' : 
                       patient?.Severity === 'Moderate' ? 'var(--warning)' : 'var(--success)';

  // The Stitch 'Risk Pulse' Custom Sparkline Data
  const riskPulseData = patient ? [
    { timeline: 'Baseline', risk: 0 },
    { timeline: 'Stage 1 (Admit)', risk: parseFloat((patient.Stage_1_Admission_Risk * 100).toFixed(1)) },
    { timeline: 'Stage 2 (Readmit)', risk: patient.Stage_2_Readmission_Risk !== null ? parseFloat((patient.Stage_2_Readmission_Risk * 100).toFixed(1)) : 0 }
  ] : [];

  return (
    <>
      <div 
        className={`slide-backdrop ${isOpen ? 'open' : ''}`} 
        onClick={onClose}
      />
      <div className={`slide-panel ${isOpen ? 'open' : ''}`}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             Patient Record
          </h2>
          <button onClick={onClose} className="icon-btn">
            <X size={20} />
          </button>
        </div>

        {patient && (
          <div style={{ padding: '1.5rem', overflowY: 'auto', height: 'calc(100vh - 80px)' }}>
            
            {/* Header Profile - Using Medical Glowing Border */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '2rem' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 25px ${severityColor}44`, border: `2px solid ${severityColor}aa` }}>
                <User size={30} color={severityColor} />
              </div>
              <div>
                <h1 style={{ fontSize: '1.75rem', marginBottom: '0.2rem' }}>{patient.Patient_ID}</h1>
                <p style={{ margin: '0', color: 'var(--text-muted)' }}>{patient.Age} yrs • {patient.Sex}</p>
                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className={`badge ${patient.Severity.toLowerCase()}`}>{patient.Severity} Risk Profile</span>
                </div>
              </div>
            </div>

            {/* Signature Risk Pulse Chart (Stitch AI Component) */}
            <h3 style={{ paddingBottom: '0.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontFamily: 'Manrope, sans-serif' }}>
              <Activity size={18} color="var(--primary)" /> Risk Pulse Timeline
            </h3>
            <div style={{ background: 'var(--bg-surface-high)', padding: '1rem', borderRadius: '1rem', border: '1px solid var(--border-light)', marginBottom: '2rem' }}>
                <div style={{ height: '100px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={riskPulseData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="var(--danger)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="timeline" hide />
                      <YAxis hide domain={[0, 100]} />
                      <Tooltip 
                        contentStyle={{ background: 'var(--bg-surface-highest)', borderColor: 'var(--border-light)', borderRadius: '0.5rem' }}
                        itemStyle={{ color: 'var(--text-main)', fontFamily: 'Manrope, sans-serif' }}
                        formatter={(value) => [`${value}%`, 'Probability']}
                      />
                      <Area type="monotone" dataKey="risk" stroke="var(--danger)" strokeWidth={3} fillOpacity={1} fill="url(#colorRisk)" activeDot={{ r: 6, fill: 'var(--danger)', stroke: 'var(--bg-card)', strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.75rem', padding: '0 0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <span>Initial</span>
                    <span>Admission</span>
                    <span>Readmission</span>
                </div>
            </div>

            {/* Risk Factors */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
              <div className="stat-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="label">Admission Risk</span>
                  <Activity size={16} color="var(--primary)" />
                </div>
                <div className="value" style={{ color: patient.Stage_1_Admission_Risk > 0.5 ? 'var(--danger)' : '#fff' }}>
                  {(patient.Stage_1_Admission_Risk * 100).toFixed(1)}%
                </div>
              </div>

              <div className="stat-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="label">Readmission Exp.</span>
                  <HeartPulse size={16} color="var(--warning)" />
                </div>
                <div className="value">
                  {patient.Stage_2_Readmission_Risk !== null ? 
                    <span style={{ color: patient.Stage_2_Readmission_Risk > 0.5 ? 'var(--warning)' : '#fff' }}>{(patient.Stage_2_Readmission_Risk * 100).toFixed(1)}%</span> : 
                    <span style={{ fontSize: '1rem', fontWeight: '400', color: 'var(--text-muted)' }}>N/A</span>
                  }
                </div>
              </div>
            </div>

            {/* Individual SHAP Explainer */}
            <h3 style={{ paddingBottom: '0.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontFamily: 'Manrope, sans-serif' }}>
              <AlertCircle size={18} color="var(--danger)" /> Primary Predictive Drivers
            </h3>
            
            <div style={{ background: 'var(--bg-surface-high)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-light)' }}>
              {shapData.length > 0 ? (
                <div style={{ height: '300px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={shapData}
                      layout="vertical"
                      margin={{ top: 0, right: 30, left: 10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis type="number" tickFormatter={(value) => `${value}%`} stroke="var(--text-muted)" fontSize={11} axisLine={false} tickLine={false} />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fill: 'var(--text-main)', fontSize: '0.75rem' }} axisLine={false} tickLine={false} />
                      <Tooltip 
                        cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                        formatter={(value) => [`+${value.toFixed(1)}% Impact`, 'SHAP Bias']}
                      />
                      <Bar dataKey="impact" radius={[0, 4, 4, 0]} barSize={20}>
                        {shapData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={'url(#panelGradient)'} />
                        ))}
                      </Bar>
                      <defs>
                        <linearGradient id="panelGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="var(--warning)" stopOpacity={0.7}/>
                          <stop offset="100%" stopColor="var(--danger)" stopOpacity={1}/>
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  {patient.Predicted_Admission === 1 ? 
                    "Detailed SHAP drivers not explicitly heavily skewed." : 
                    "Patient predicted as low-risk; no extreme positive drivers."}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
