import React, { useState, useMemo } from 'react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Cell, AreaChart, Area, Legend } from 'recharts';
import { Activity, ShieldAlert, Users, AlertTriangle, TrendingUp, Filter } from 'lucide-react';

export default function EDAView({ data }) {
  // Global Filters
  const [filterGender, setFilterGender] = useState('All');
  const [filterSeverity, setFilterSeverity] = useState('All');

  // Filter the dataset BEFORE any EDAs calculate
  const filteredData = useMemo(() => {
    let rs = data;
    if (filterGender !== 'All') {
      rs = rs.filter(d => d.Sex === filterGender);
    }
    if (filterSeverity !== 'All') {
      rs = rs.filter(d => d.Severity === filterSeverity);
    }
    return rs;
  }, [data, filterGender, filterSeverity]);

  // Aggregate Extended Metrics
  const metrics = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return { avgRisk: 0, readmitRate: 0, totalAdmitted: 0 };
    
    let totalRisk = 0;
    let admittedCount = 0;
    let readmittedCount = 0;

    filteredData.forEach(d => {
      totalRisk += (d.Stage_1_Admission_Risk || 0);
      if (d.Predicted_Admission === 1) {
        admittedCount++;
        if (d.Stage_2_Readmission_Risk !== null && d.Stage_2_Readmission_Risk >= 0.5) {
          readmittedCount++;
        }
      }
    });

    return {
      avgRisk: (totalRisk / filteredData.length) * 100,
      readmitRate: admittedCount > 0 ? (readmittedCount / admittedCount) * 100 : 0,
      totalAdmitted: admittedCount
    };
  }, [filteredData]);

  // Aggregate Age vs Avg Admission Risk
  const ageRiskData = useMemo(() => {
    if (!filteredData) return [];
    let buckets = {
        '<40': { totalRisk: 0, count: 0 },
        '40-49': { totalRisk: 0, count: 0 },
        '50-59': { totalRisk: 0, count: 0 },
        '60-69': { totalRisk: 0, count: 0 },
        '70-79': { totalRisk: 0, count: 0 },
        '80+': { totalRisk: 0, count: 0 },
    };

    filteredData.forEach(d => {
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
  }, [filteredData]);

  // Aggregate Top Risk Drivers across the currently filtered payload
  const aggregatedDrivers = useMemo(() => {
    let counts = {};
    if (!filteredData || filteredData.length === 0) return [];
    
    filteredData.forEach(patient => {
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
  }, [filteredData]);

  return (
    <div className="glass-card table-view-container" style={{ padding: '0', display: 'flex', flexDirection: 'column' }}>
      
      {/* Landing Page Navbar & Filters */}
      <div style={{ padding: '2rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: '0', display: 'flex', alignItems: 'center', gap: '0.75rem', fontFamily: 'Manrope, sans-serif' }}>
            <Activity color="var(--primary)" /> Clinical Command Center
          </h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Dataset Macro Overview & Exploratory Attributes</p>
        </div>
        
        {/* Global Filter Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', background: 'var(--bg-dark)', padding: '0.5rem 1rem', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
              <Filter size={16} /> Filters:
           </div>
           
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Gender</span>
              <select 
                value={filterGender} 
                onChange={e => setFilterGender(e.target.value)}
                style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-light)', padding: '0.35rem', borderRadius: '6px', outline: 'none', cursor: 'pointer' }}
              >
                <option value="All">All Genders</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
           </div>
           
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Severity</span>
              <select 
                value={filterSeverity} 
                onChange={e => setFilterSeverity(e.target.value)}
                style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-light)', padding: '0.35rem', borderRadius: '6px', outline: 'none', cursor: 'pointer' }}
              >
                <option value="All">All Severities</option>
                <option value="Severe">Severe Risk</option>
                <option value="Moderate">Moderate Risk</option>
                <option value="Mild">Mild Risk</option>
              </select>
           </div>
        </div>
      </div>

      <div style={{ padding: '2rem' }}>
        
        {/* Landing Top Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
          
          <div className="stat-box" style={{ background: 'var(--bg-surface-high)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
               <span className="label" style={{ color: 'var(--text-muted)' }}>Active Filter Cohort</span>
               <Users size={16} color="var(--primary)" />
            </div>
            <div className="value" style={{ fontSize: '2.5rem' }}>{filteredData.length.toLocaleString()}</div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Total predictive records matching parameters
            </p>
          </div>
          
          <div className="stat-box" style={{ background: 'var(--bg-surface-high)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
               <span className="label" style={{ color: 'var(--text-muted)' }}>Avg. Admission Risk</span>
               <TrendingUp size={16} color={metrics.avgRisk > 40 ? 'var(--danger)' : 'var(--primary)'} />
            </div>
            <div className="value" style={{ fontSize: '2.5rem', color: metrics.avgRisk > 40 ? 'var(--danger)' : '#fff' }}>
               {metrics.avgRisk.toFixed(1)}<span style={{fontSize: '1.25rem'}}>%</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Out of {data.length.toLocaleString()} global baseline Average
            </p>
          </div>
          
          <div className="stat-box" style={{ background: 'var(--bg-surface-high)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
               <span className="label" style={{ color: 'var(--text-muted)' }}>Readmission Cov. Rate</span>
               <AlertTriangle size={16} color="var(--warning)" />
            </div>
            <div className="value" style={{ fontSize: '2.5rem', color: 'var(--warning)' }}>
               {metrics.readmitRate.toFixed(1)}<span style={{fontSize: '1.25rem'}}>%</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Percent of the {metrics.totalAdmitted.toLocaleString()} admitted expected to readmit
            </p>
          </div>
        </div>

        {/* Exploratory Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
            
            {/* Age vs Risk Chart (Area Chart styled) */}
            <div style={{ background: 'var(--bg-surface)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-light)' }}>
                <h3 style={{ marginBottom: '1.5rem', fontSize: '1rem', color: 'var(--text-main)', fontFamily: 'Manrope, sans-serif' }}>Baseline Risk Velocity by Age</h3>
                <div style={{ width: '100%', height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={ageRiskData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorRiskAvg" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.6}/>
                                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} tickFormatter={v => v+'%'} />
                            <Tooltip 
                                cursor={{ stroke: 'var(--border-light)' }}
                                contentStyle={{ background: 'var(--bg-surface-highest)', border: '1px solid var(--border-light)', borderRadius: '8px', color: '#fff', fontFamily: 'Manrope, sans-serif' }}
                                formatter={(value) => [`${value.toFixed(1)}%`, 'Avg Admission Risk']}
                            />
                            <Area type="monotone" dataKey="avgRisk" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorRiskAvg)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Top SHAP Drivers BarChart */}
            <div style={{ background: 'var(--bg-surface)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-light)' }}>
                 <h3 style={{ marginBottom: '1.5rem', fontSize: '1rem', color: 'var(--text-main)', fontFamily: 'Manrope, sans-serif' }}>Dataset-Wide Pathological Drivers</h3>
                <div style={{ width: '100%', height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                        data={aggregatedDrivers}
                        layout="vertical"
                        margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
                        >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis type="number" stroke="var(--text-muted)" fontSize={11} tickFormatter={val => val + ' cases'} axisLine={false} tickLine={false} hide />
                        <YAxis dataKey="name" type="category" width={150} tick={{ fill: 'var(--text-main)', fontSize: '0.75rem' }} axisLine={false} tickLine={false} />
                        <Tooltip 
                            cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                            contentStyle={{ background: 'var(--bg-surface-highest)', border: '1px solid var(--border-light)', borderRadius: '8px', color: '#fff' }}
                            formatter={(value) => [`${value.toLocaleString()} patients`, 'Most impactful Driver']}
                        />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={15}>
                            {aggregatedDrivers.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={'url(#panelGradientGlobal)'} />
                            ))}
                        </Bar>
                        <defs>
                            <linearGradient id="panelGradientGlobal" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="var(--warning)" stopOpacity={0.7}/>
                            <stop offset="100%" stopColor="var(--danger)" stopOpacity={1}/>
                            </linearGradient>
                        </defs>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
