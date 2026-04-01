import React, { useState, useMemo } from 'react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Cell, AreaChart, Area } from 'recharts';
import { Activity, Users, AlertTriangle, TrendingUp, Filter, ShieldAlert, Clock } from 'lucide-react';

export default function EDAView({ data }) {
  // Global Filters
  const [filterGender, setFilterGender] = useState('All');
  const [filterSeverity, setFilterSeverity] = useState('All');

  // Sub-navigation SHAP plot states
  const [activeAdmTab, setActiveAdmTab] = useState('beeswarm'); // 'beeswarm' | 'waterfall'
  const [activeReadmTab, setActiveReadmTab] = useState('beeswarm'); 

  // Strict dataset filter before processing mapping rules.
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

  // Aggregate Extended Metrics for Macro Level Stats
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

  // Aggregate Age vs Avg Admission Risk for Top Recharts Area
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
      .slice(0, 8);
  }, [filteredData]);

  // Calculate Avg Length of Stay (Avg_LOS) by Severity Bracket
  const losRiskData = useMemo(() => {
    if (!filteredData) return [];
    let buckets = {
        'Mild': { totalLos: 0, count: 0 },
        'Moderate': { totalLos: 0, count: 0 },
        'Severe': { totalLos: 0, count: 0 }
    };

    filteredData.forEach(d => {
        let { Severity, Avg_LOS } = d;
        if (Avg_LOS === undefined) return;
        if (buckets[Severity]) {
           buckets[Severity].totalLos += Avg_LOS;
           buckets[Severity].count++;
        }
    });

    return Object.keys(buckets).map(k => ({
        name: k,
        avgLos: buckets[k].count > 0 ? (buckets[k].totalLos / buckets[k].count) : 0,
        count: buckets[k].count
    }));
  }, [filteredData]);

  return (
    <div className="glass-card table-view-container" style={{ padding: '0', display: 'flex', flexDirection: 'column' }}>
      
      {/* Landing Page Navbar & Filters */}
      <div style={{ padding: '2.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div>
          <h2 style={{ margin: '0', display: 'flex', alignItems: 'center', gap: '0.75rem', fontFamily: 'Manrope, sans-serif', fontSize: '1.75rem' }}>
            <Activity color="var(--primary)" size={28} /> Clinical Command Center
          </h2>
          <p style={{ margin: '0.5rem 0 0', fontSize: '1rem', color: 'var(--text-muted)' }}>Dataset Macro Overview & Exploratory Attributes</p>
        </div>
        
        {/* Global Filter Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', background: 'var(--bg-card)', padding: '0.75rem 1.5rem', borderRadius: '14px', border: '1px solid var(--border-light)', boxShadow: 'var(--glass-shadow)' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontWeight: '500' }}>
              <Filter size={18} /> Filters:
           </div>
           
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Gender</span>
              <select 
                value={filterGender} 
                onChange={e => setFilterGender(e.target.value)}
                style={{ background: 'var(--bg-surface)', color: 'var(--text-main)', border: '1px solid var(--border-light)', padding: '0.45rem', borderRadius: '8px', outline: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
              >
                <option value="All">All Genders</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
           </div>
           
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Severity</span>
              <select 
                value={filterSeverity} 
                onChange={e => setFilterSeverity(e.target.value)}
                style={{ background: 'var(--bg-surface)', color: 'var(--text-main)', border: '1px solid var(--border-light)', padding: '0.45rem', borderRadius: '8px', outline: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
              >
                <option value="All">All Severities</option>
                <option value="Severe">Severe Risk</option>
                <option value="Moderate">Moderate Risk</option>
                <option value="Mild">Mild Risk</option>
              </select>
           </div>
        </div>
      </div>

      <div style={{ padding: '3rem' }}>
        
        {/* Landing Top Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem', marginBottom: '3rem' }}>
          
          <div className="stat-box">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
               <span className="label">Active Filter Cohort</span>
               <Users size={20} color="var(--primary)" />
            </div>
            <div className="value" style={{ fontSize: '3rem' }}>{filteredData.length.toLocaleString()}</div>
            <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-muted)' }}>
              Total predictive records matching parameters
            </p>
          </div>
          
          <div className="stat-box">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
               <span className="label">Avg. Admission Risk</span>
               <TrendingUp size={20} color={metrics.avgRisk > 40 ? 'var(--danger)' : 'var(--primary)'} />
            </div>
            <div className="value" style={{ fontSize: '3rem', color: metrics.avgRisk > 40 ? 'var(--danger)' : 'var(--text-main)' }}>
               {metrics.avgRisk.toFixed(1)}<span style={{fontSize: '1.5rem'}}>%</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-muted)' }}>
              Out of {data.length.toLocaleString()} global baseline Average
            </p>
          </div>
          
          <div className="stat-box">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
               <span className="label">Readmission Conversion Rate</span>
               <AlertTriangle size={20} color="var(--warning)" />
            </div>
            <div className="value" style={{ fontSize: '3rem', color: 'var(--warning)' }}>
               {metrics.readmitRate.toFixed(1)}<span style={{fontSize: '1.5rem'}}>%</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-muted)' }}>
              Percent of the {metrics.totalAdmitted.toLocaleString()} admitted expected to readmit
            </p>
          </div>
        </div>

        {/* Global SHAP Matrix Sub-Tab Injection Base */}
        <h2 style={{ paddingTop: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.5rem', marginBottom: '2.5rem' }}>
            <Activity color="var(--danger)" size={24} /> Explicit Machine Learning SHAP Extrapolations
        </h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', marginBottom: '4rem' }}>
           
           {/* Admission SHAP Tabs */}
           <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '1.25rem', border: '1px solid var(--border-light)', boxShadow: 'var(--glass-shadow)', display: 'flex', flexDirection: 'column' }}>
               <h3 style={{ marginBottom: '1rem', color: 'var(--text-main)', fontSize: '1.15rem' }}>Admission TreeExplainer (Stage 1)</h3>
               
               {/* Nav Module */}
               <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-dark)', padding: '0.4rem', borderRadius: '12px', border: '1px solid var(--border-light)', marginBottom: '1.5rem' }}>
                  <button 
                    onClick={() => setActiveAdmTab('beeswarm')}
                    style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', border: 'none', background: activeAdmTab === 'beeswarm' ? 'var(--bg-surface-high)' : 'transparent', color: activeAdmTab === 'beeswarm' ? '#fff' : 'var(--text-muted)', fontWeight: activeAdmTab === 'beeswarm' ? '600' : '500', transition: 'var(--transition)' }}
                  >
                    Global Beeswarm Scatter
                  </button>
                  <button 
                    onClick={() => setActiveAdmTab('waterfall')}
                    style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', border: 'none', background: activeAdmTab === 'waterfall' ? 'var(--bg-surface-high)' : 'transparent', color: activeAdmTab === 'waterfall' ? '#fff' : 'var(--text-muted)', fontWeight: activeAdmTab === 'waterfall' ? '600' : '500', transition: 'var(--transition)' }}
                  >
                    Patient Waterfall Prototype
                  </button>
               </div>
               
               {/* Extracted Asset Render */}
               <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-dark)', borderRadius: '0.75rem', padding: '1rem', border: '1px solid var(--border-light)' }}>
                  <img 
                    src={activeAdmTab === 'beeswarm' ? "/assets/shap_adm_beeswarm.png" : "/assets/shap_adm_waterfall.png"}
                    alt={`Stage 1 Admission ${activeAdmTab}`}
                    style={{ maxWidth: '100%', height: 'auto', borderRadius: '0.5rem' }}
                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                  />
                  <div style={{ display: 'none', color: 'var(--danger)', padding: '2rem', textAlign: 'center' }}>
                     Failed to load Pyplot Extrapolation script. Please wait for execution synchronization.
                  </div>
               </div>
           </div>

           {/* Readmission SHAP Tabs */}
           <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '1.25rem', border: '1px solid var(--border-light)', boxShadow: 'var(--glass-shadow)', display: 'flex', flexDirection: 'column' }}>
               <h3 style={{ marginBottom: '1rem', color: 'var(--text-main)', fontSize: '1.15rem' }}>Readmission TreeExplainer (Stage 2)</h3>
               
               {/* Nav Module */}
               <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-dark)', padding: '0.4rem', borderRadius: '12px', border: '1px solid var(--border-light)', marginBottom: '1.5rem' }}>
                  <button 
                    onClick={() => setActiveReadmTab('beeswarm')}
                    style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', border: 'none', background: activeReadmTab === 'beeswarm' ? 'var(--bg-surface-high)' : 'transparent', color: activeReadmTab === 'beeswarm' ? '#fff' : 'var(--text-muted)', fontWeight: activeReadmTab === 'beeswarm' ? '600' : '500', transition: 'var(--transition)' }}
                  >
                    Global Beeswarm Scatter
                  </button>
                  <button 
                    onClick={() => setActiveReadmTab('waterfall')}
                    style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', border: 'none', background: activeReadmTab === 'waterfall' ? 'var(--bg-surface-high)' : 'transparent', color: activeReadmTab === 'waterfall' ? '#fff' : 'var(--text-muted)', fontWeight: activeReadmTab === 'waterfall' ? '600' : '500', transition: 'var(--transition)' }}
                  >
                    Patient Waterfall Prototype
                  </button>
               </div>
               
               {/* Extracted Asset Render */}
               <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-dark)', borderRadius: '0.75rem', padding: '1rem', border: '1px solid var(--border-light)' }}>
                  <img 
                    src={activeReadmTab === 'beeswarm' ? "/assets/shap_readm_beeswarm.png" : "/assets/shap_readm_waterfall.png"}
                    alt={`Stage 2 Readmission ${activeReadmTab}`}
                    style={{ maxWidth: '100%', height: 'auto', borderRadius: '0.5rem' }}
                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                  />
                  <div style={{ display: 'none', color: 'var(--danger)', padding: '2rem', textAlign: 'center' }}>
                     Failed to load Pyplot Extrapolation script. Please wait for execution synchronization.
                  </div>
               </div>
           </div>

        </div>

        {/* Exploratory Charts */}
        <h2 style={{ paddingTop: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.5rem', marginBottom: '2.5rem' }}>
            <TrendingUp color="var(--primary)" size={24} /> Core Demographical Algorithms
        </h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3rem', marginBottom: '3rem' }}>
            
            {/* Age vs Risk Chart */}
            <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '1.25rem', border: '1px solid var(--border-light)', boxShadow: 'var(--glass-shadow)' }}>
                <h3 style={{ marginBottom: '1.5rem', fontSize: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Activity size={16} color="var(--primary)" /> Baseline Risk Velocity by Age
                </h3>
                <div style={{ width: '100%', height: '280px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={ageRiskData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorRiskAvg" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.5}/>
                                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                            <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => v+'%'} />
                            <Tooltip 
                                cursor={{ stroke: 'var(--border-light)' }}
                                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '12px', color: 'var(--text-main)' }}
                                formatter={(value) => [`${value.toFixed(1)}%`, 'Avg Admission Risk']}
                            />
                            <Area type="monotone" dataKey="avgRisk" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorRiskAvg)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Top SHAP Drivers BarChart */}
            <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '1.25rem', border: '1px solid var(--border-light)', boxShadow: 'var(--glass-shadow)' }}>
                <h3 style={{ marginBottom: '1.5rem', fontSize: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ShieldAlert size={16} color="var(--danger)" /> Global Top Pathological Drivers
                </h3>
                <div style={{ width: '100%', height: '280px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                        data={aggregatedDrivers}
                        layout="vertical"
                        margin={{ top: 0, right: 10, left: 10, bottom: 0 }}
                        >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-light)" />
                        <XAxis type="number" stroke="var(--text-muted)" fontSize={11} tickFormatter={val => val} axisLine={false} tickLine={false} hide />
                        <YAxis dataKey="name" type="category" width={110} tick={{ fill: 'var(--text-main)', fontSize: '0.75rem' }} axisLine={false} tickLine={false} />
                        <Tooltip 
                            cursor={{ fill: 'rgba(120,120,120,0.05)' }}
                            contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '12px', color: 'var(--text-main)' }}
                            formatter={(value) => [`${value.toLocaleString()} patients`, 'Leading Influence']}
                        />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={14}>
                            {aggregatedDrivers.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={'url(#panelGradientGlobalX)'} />
                            ))}
                        </Bar>
                        <defs>
                            <linearGradient id="panelGradientGlobalX" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="var(--warning)" stopOpacity={0.8}/>
                            <stop offset="100%" stopColor="var(--danger)" stopOpacity={1}/>
                            </linearGradient>
                        </defs>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* BRAND NEW LOGISTIC RESOURCE CHART: LOS vs Severity */}
            <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '1.25rem', border: '1px solid var(--border-light)', boxShadow: 'var(--glass-shadow)' }}>
                <h3 style={{ marginBottom: '1.5rem', fontSize: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Clock size={16} color="var(--success)" /> Predicted Length of Stay Timeline
                </h3>
                <div style={{ width: '100%', height: '280px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={losRiskData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                            <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => v + ' days'} />
                            <Tooltip 
                                cursor={{ fill: 'rgba(120,120,120,0.05)' }}
                                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '12px', color: 'var(--text-main)' }}
                                formatter={(value) => [`${value.toFixed(1)} days`, 'Avg Length of Stay']}
                            />
                            <Bar dataKey="avgLos" radius={[6, 6, 0, 0]} barSize={40}>
                                {losRiskData.map((entry, index) => (
                                    <Cell 
                                      key={`cell-${index}`} 
                                      fill={entry.name === 'Severe' ? 'var(--danger)' : entry.name === 'Moderate' ? 'var(--warning)' : 'var(--success)'} 
                                      fillOpacity={0.85}
                                    />
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
