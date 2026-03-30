import React, { useMemo } from 'react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Cell, PieChart, Pie, Legend } from 'recharts';
import { Activity, ShieldAlert, BarChart3, Info, Users, AlertTriangle } from 'lucide-react';

export default function EDAView({ data }) {
  // Aggregate severity distribution
  const severityDist = useMemo(() => {
    if (!data) return [];
    let counts = { Mild: 0, Moderate: 0, Severe: 0 };
    data.forEach(d => {
      if (counts[d.Severity] !== undefined) counts[d.Severity]++;
    });
    return [
      { name: 'Mild', value: counts.Mild, fill: 'var(--success)' },
      { name: 'Moderate', value: counts.Moderate, fill: 'var(--warning)' },
      { name: 'Severe', value: counts.Severe, fill: 'var(--danger)' }
    ];
  }, [data]);

  // Aggregate Top Risk Drivers across all predicted
  const aggregatedDrivers = useMemo(() => {
    let counts = {};
    if (!data || data.length === 0) return [];
    
    data.forEach(patient => {
      if (patient.Top_Risk_Drivers && patient.Top_Risk_Drivers.length > 0) {
        patient.Top_Risk_Drivers.forEach(driverLine => {
          const featureName = driverLine.split(' (+')[0];
          counts[featureName] = (counts[featureName] || 0) + 1;
        });
      }
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [data]);

  // Aggregate Age vs Avg Admission Risk
  const ageRiskData = useMemo(() => {
    if (!data) return [];
    // Group ages into buckets: <40, 40-50, 50-60, 60-70, 70-80, 80+
    let buckets = {
        '<40': { totalRisk: 0, count: 0 },
        '40-49': { totalRisk: 0, count: 0 },
        '50-59': { totalRisk: 0, count: 0 },
        '60-69': { totalRisk: 0, count: 0 },
        '70-79': { totalRisk: 0, count: 0 },
        '80+': { totalRisk: 0, count: 0 },
    };

    data.forEach(d => {
        let age = d.Age;
        let risk = d.Stage_1_Admission_Risk;
        if (age < 40) { buckets['<40'].totalRisk += risk; buckets['<40'].count++; }
        else if (age < 50) { buckets['40-49'].totalRisk += risk; buckets['40-49'].count++; }
        else if (age < 60) { buckets['50-59'].totalRisk += risk; buckets['50-59'].count++; }
        else if (age < 70) { buckets['60-69'].totalRisk += risk; buckets['60-69'].count++; }
        else if (age < 80) { buckets['70-79'].totalRisk += risk; buckets['70-79'].count++; }
        else { buckets['80+'].totalRisk += risk; buckets['80+'].count++; }
    });

    return Object.keys(buckets).map(k => ({
        name: k,
        avgRisk: buckets[k].count > 0 ? (buckets[k].totalRisk / buckets[k].count) * 100 : 0
    }));
  }, [data]);

  const totalPredicted = data.filter(d => d.Predicted_Admission === 1).length;

  return (
    <div className="glass-card" style={{ padding: '0' }}>
      <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <BarChart3 color="var(--primary)" />
        <div>
          <h2 style={{ margin: '0' }}>Exploratory Data Analysis</h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>Dataset-wide Insights & Risk Feature Attribution</p>
        </div>
      </div>

      <div style={{ padding: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
          <div className="stat-box" style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <span className="label" style={{ color: '#93c5fd', display: 'flex', gap: '0.5rem' }}><Users size={16}/> Total Analyzed Dataset</span>
            <div className="value" style={{ fontSize: '2rem' }}>{data.length.toLocaleString()}</div>
            <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Unique historical records</p>
          </div>
          <div className="stat-box" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <span className="label" style={{ color: '#fca5a5', display: 'flex', gap: '0.5rem' }}><AlertTriangle size={16}/> Admitted Patients</span>
            <div className="value" style={{ fontSize: '2rem', color: '#fca5a5' }}>{totalPredicted.toLocaleString()}</div>
            <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{((totalPredicted/data.length)*100).toFixed(1)}% predicted baseline risk</p>
          </div>
          <div className="stat-box" style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
            <span className="label" style={{ color: '#fcd34d' }}>Predominant Severity Level</span>
            <div className="value" style={{ fontSize: '2rem', color: '#fcd34d' }}>
              {severityDist.reduce((max, current) => max.value > current.value ? max : current, {value: 0}).name}
            </div>
            <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Most common mapped encoding</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
            {/* Severity Pie Chart */}
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-light)' }}>
                <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', color: 'var(--text-main)' }}>Encoded Severity Breakdown</h3>
                <div style={{ width: '100%', height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={severityDist}
                                innerRadius={70}
                                outerRadius={110}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {severityDist.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Pie>
                            <Tooltip 
                                cursor={{ fill: 'transparent' }}
                                contentStyle={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                            />
                            <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Age vs Risk Chart */}
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-light)' }}>
                <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', color: 'var(--text-main)' }}>Average Admission Risk by Age</h3>
                <div style={{ width: '100%', height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={ageRiskData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} tickFormatter={v => v+'%'} />
                            <Tooltip 
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                contentStyle={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                                formatter={(value) => [`${value.toFixed(1)}%`, 'Avg Admission Risk']}
                            />
                            <Bar dataKey="avgRisk" radius={[4, 4, 0, 0]} barSize={40} fill="rgba(59, 130, 246, 0.8)">
                                {ageRiskData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={'var(--primary)'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>

        <div>
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldAlert size={18} color="var(--warning)" /> Top Inferred Predictors (SHAP Global Attributes)
          </h3>
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-light)' }}>
            
            <div style={{ width: '100%', height: '350px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={aggregatedDrivers}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" stroke="var(--text-muted)" fontSize={12} tickFormatter={val => val + ' cases'} />
                  <YAxis dataKey="name" type="category" width={180} tick={{ fill: 'var(--text-main)', fontSize: '0.85rem' }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                    formatter={(value) => [`${value.toLocaleString()} patients`, 'Most impactful Driver']}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={25}>
                    {aggregatedDrivers.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={'var(--warning)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
