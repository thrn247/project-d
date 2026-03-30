import React from 'react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Cell } from 'recharts';
import { ArrowLeft, User, Activity, AlertTriangle, HelpCircle } from 'lucide-react';

export default function PatientDetail({ patient, onBack }) {
  if (!patient) return null;

  // Prepare SHAP Data for chart
  const shapData = [];
  if (patient.Top_Risk_Drivers && patient.Top_Risk_Drivers.length > 0) {
    patient.Top_Risk_Drivers.forEach(driver => {
      // "FeatureName (+20.5%)"
      const parts = driver.split(' (+');
      if (parts.length === 2) {
        shapData.push({
          name: parts[0],
          impact: parseFloat(parts[1].replace('%)', ''))
        });
      }
    });
  }

  // Gradient Colors based on Risk level
  const riskColor = patient.Stage_1_Admission_Risk > 0.8 ? '#ef4444' : 
                   patient.Stage_1_Admission_Risk > 0.4 ? '#f59e0b' : 
                   patient.Stage_1_Admission_Risk > 0.15 ? '#3b82f6' : '#10b981';

                   
  return (
    <div className="glass-card" style={{ padding: '2rem' }}>
      <button 
        onClick={onBack}
        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '2rem', fontSize: '1rem', fontWeight: '500' }}
      >
        <ArrowLeft size={18} /> Back to Triage Queue
      </button>

      <div className="detail-grid">
        {/* Left Sidebar */}
        <div className="profile-sidebar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-light)' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--bg-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 15px rgba(255,255,255,0.05)' }}>
              <User size={30} color={riskColor} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.5rem', marginBottom: '0' }}>Patient {patient.Patient_ID}</h1>
              <p style={{ margin: '0', color: 'var(--text-muted)' }}>{patient.Age} years old • {patient.Sex}</p>
            </div>
          </div>

          <div className="stat-box" style={{ background: `linear-gradient(135deg, rgba(30,41,59,0.8), rgba(${riskColor.replace('#','').match(/.{2}/g).map(x=>parseInt(x,16)).join(',')},0.15))` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="label">Stage 1 Admission Risk</span>
              <Activity size={16} color={riskColor} />
            </div>
            <div className="value" style={{ color: riskColor }}>{(patient.Stage_1_Admission_Risk * 100).toFixed(1)}%</div>
            <span className={`badge ${patient.Severity.toLowerCase()}`} style={{ display: 'inline-block', width: 'fit-content', marginTop: '0.5rem' }}>{patient.Severity}</span>
          </div>

          <div className="stat-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="label">Stage 2 Readmission Expected</span>
              {patient.Predicted_Admission === 1 ? <AlertTriangle size={16} color="var(--warning)" /> : <HelpCircle size={16} color="var(--text-muted)" />}
            </div>
            <div className="value">
              {patient.Predicted_Admission === 1 && patient.Stage_2_Readmission_Risk !== null ? 
                <span style={{ color: 'var(--warning)' }}>{(patient.Stage_2_Readmission_Risk * 100).toFixed(1)}%</span> : 
                <span style={{ fontSize: '1rem', fontWeight: '400', color: 'var(--text-muted)' }}>No initial admission</span>
              }
            </div>
            <p style={{ fontSize: '0.8rem', margin: '0.25rem 0 0', opacity: 0.8 }}>Conditioned on admission</p>
          </div>
        </div>

        {/* Right Info Section */}
        <div>
          <h3 style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={18} color="var(--primary)" /> SHAP Explanation: Top Risk Drivers
          </h3>
          
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '2rem', borderRadius: '16px', border: '1px solid var(--border-light)' }}>
            {shapData.length > 0 ? (
              <div style={{ height: '300px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={shapData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" tickFormatter={(value) => `${value}%`} stroke="var(--text-muted)" fontSize={12} />
                    <YAxis dataKey="name" type="category" width={150} tick={{ fill: 'var(--text-main)', fontSize: '0.85rem' }} axisLine={false} tickLine={false} />
                    <Tooltip 
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      contentStyle={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                      formatter={(value) => [`+${value.toFixed(1)}% Risk Contribution`, 'SHAP Impact']}
                    />
                    <Bar dataKey="impact" radius={[0, 4, 4, 0]} barSize={35}>
                      {shapData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`url(#colorImpact)`} />
                      ))}
                    </Bar>
                    <defs>
                      <linearGradient id="colorImpact" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#fca5a5" stopOpacity={0.8}/>
                        <stop offset="100%" stopColor="#ef4444" stopOpacity={1}/>
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                {patient.Predicted_Admission === 1 ? 
                  "Detailed explanation not available." : 
                  "Patient predicted as low-risk; no prominent positive risk drivers detected."}
              </div>
            )}
            
            {shapData.length > 0 && (
              <p style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                <strong>Clinical Interpretation:</strong> The model highlights <strong style={{color: '#fca5a5'}}>{shapData[0]?.name}</strong> as the primary factor pushing this patient towards admission, increasing their risk log-odds by roughly {shapData[0]?.impact}%.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
