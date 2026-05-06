import React, { useMemo, Fragment } from 'react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Cell, ReferenceLine, LabelList } from 'recharts';
import { Activity, Users, AlertTriangle, TrendingUp, ShieldAlert, BarChart2, Search } from 'lucide-react';
import InfoTip from './InfoTip';
import CohortFilterBar from './CohortFilterBar';
import EmptyState from './EmptyState';
import { labelFor } from '../featureLabels';
import { getTips } from '../copy';
import { applyFilters, ageBandFor, isFilterActive } from '../filters';
import { useNumberTween } from '../hooks/useNumberTween';

export default function EDAView({ data, thresholds, filters, updateFilters, clearAllFilters, onJumpToPredictions }) {
  const tips = useMemo(() => getTips(thresholds), [thresholds]);

  // Fully-filtered data — used by KPIs, cohort drivers, drill-down count.
  const filteredData = useMemo(() => applyFilters(data, filters), [data, filters]);

  // Per-chart "exclude self" data — each chart sees the cohort filtered by every
  // dimension except the one it controls, so highlighting an active band doesn't
  // make the chart itself collapse to one bar.
  const ageChartData = useMemo(() => applyFilters(data, filters, 'ageBand'), [data, filters]);
  const histChartData = useMemo(() => applyFilters(data, filters, 'riskBand'), [data, filters]);
  const matrixChartData = useMemo(() => applyFilters(data, filters, ['severity', 'gender']), [data, filters]);

  const metrics = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return { avgRisk: 0, readmitRate: 0, totalAdmitted: 0 };
    let totalRisk = 0, admittedCount = 0, readmittedCount = 0;
    filteredData.forEach(d => {
      totalRisk += (d.Stage_1_Admission_Risk || 0);
      if (d.Predicted_Admission === 1) {
        admittedCount++;
        if (d.Stage_2_Readmission_Risk !== null && d.Stage_2_Readmission_Risk >= thresholds.readmission) {
          readmittedCount++;
        }
      }
    });
    return {
      avgRisk: (totalRisk / filteredData.length) * 100,
      readmitRate: admittedCount > 0 ? (readmittedCount / admittedCount) * 100 : 0,
      totalAdmitted: admittedCount
    };
  }, [filteredData, thresholds]);

  const globalAvgRisk = useMemo(() => {
    if (!data || data.length === 0) return 0;
    return (data.reduce((s, d) => s + (d.Stage_1_Admission_Risk || 0), 0) / data.length) * 100;
  }, [data]);

  // KPI number tweens — ease the displayed value when filters change so the
  // numbers feel coordinated with the chart re-render rather than snapping.
  // Respects prefers-reduced-motion (snaps for those users).
  const tweenedCohortCount = useNumberTween(filteredData.length, 450);
  const tweenedAvgRisk = useNumberTween(metrics.avgRisk, 450);
  const tweenedReadmitRate = useNumberTween(metrics.readmitRate, 450);

  const filtersActive = isFilterActive(filters);
  const activeFilterSummary = [
    filters.gender !== 'All' && `Sex: ${filters.gender === 'M' ? 'Male' : 'Female'}`,
    filters.severity !== 'All' && `Severity: ${filters.severity}`,
    filters.ageBand !== null && `Age: ${filters.ageBand}`,
    filters.riskBand !== null && `Risk: ${filters.riskBand}`,
  ].filter(Boolean).join(' · ');

  // (cohortPredictedAdmittedPct + globalPredictedAdmittedPct previously lived here;
  // now computed inside CohortFilterBar so the cohort summary banner can be
  // self-contained.)

  const ageRiskData = useMemo(() => {
    const buckets = {
      '<40': { totalRisk: 0, count: 0 },
      '40-49': { totalRisk: 0, count: 0 },
      '50-59': { totalRisk: 0, count: 0 },
      '60-69': { totalRisk: 0, count: 0 },
      '70-79': { totalRisk: 0, count: 0 },
      '80+': { totalRisk: 0, count: 0 },
    };
    ageChartData.forEach(d => {
      const band = ageBandFor(d.Age);
      if (buckets[band]) {
        buckets[band].totalRisk += (d.Stage_1_Admission_Risk || 0);
        buckets[band].count++;
      }
    });
    return Object.keys(buckets).map(k => ({
      name: k,
      avgRisk: buckets[k].count > 0 ? (buckets[k].totalRisk / buckets[k].count) * 100 : 0,
      count: buckets[k].count,
    }));
  }, [ageChartData]);

  const aggregatedDrivers = useMemo(() => {
    const counts = {};
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
      .map(([name, count]) => ({ name, count, label: labelFor(name) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [filteredData]);

  const riskHistogramData = useMemo(() => {
    const bins = Array.from({ length: 10 }, (_, i) => ({
      binMid: i * 10 + 5,
      binStart: i * 10,
      name: `${i * 10}-${(i + 1) * 10}%`,
      count: 0,
      pct: 0,
    }));
    if (!histChartData || histChartData.length === 0) return bins;
    histChartData.forEach(d => {
      const score = (d.Stage_1_Admission_Risk || 0) * 100;
      const idx = Math.min(9, Math.max(0, Math.floor(score / 10)));
      bins[idx].count++;
    });
    const total = histChartData.length;
    bins.forEach(b => { b.pct = total > 0 ? (b.count / total) * 100 : 0; });
    return bins;
  }, [histChartData]);

  const severitySexMatrix = useMemo(() => {
    const cells = {};
    ['Severe', 'Moderate', 'Mild'].forEach(sev => {
      ['M', 'F'].forEach(sex => {
        cells[`${sev}-${sex}`] = { count: 0, totalRisk: 0, avgRisk: 0 };
      });
    });
    let unknownSex = 0;
    if (!matrixChartData || matrixChartData.length === 0) return { cells, unknownSex };
    matrixChartData.forEach(d => {
      if (d.Sex !== 'M' && d.Sex !== 'F') {
        unknownSex++;
        return;
      }
      const cell = cells[`${d.Severity}-${d.Sex}`];
      if (cell) {
        cell.count++;
        cell.totalRisk += (d.Stage_1_Admission_Risk || 0);
      }
    });
    Object.values(cells).forEach(c => {
      c.avgRisk = c.count > 0 ? (c.totalRisk / c.count) * 100 : 0;
    });
    return { cells, unknownSex };
  }, [matrixChartData]);

  // Click handlers — toggle behaviour: clicking the active band/cell again clears it.
  const onAgeBandClick = (band) => {
    updateFilters({ ageBand: filters.ageBand === band ? null : band });
  };
  const onRiskBandClick = (band) => {
    updateFilters({ riskBand: filters.riskBand === band ? null : band });
  };
  const onMatrixCellClick = (sev, sex) => {
    const isActive = filters.severity === sev && filters.gender === sex;
    if (isActive) {
      updateFilters({ severity: 'All', gender: 'All' });
    } else {
      updateFilters({ severity: sev, gender: sex });
    }
  };

  // Matrix cell colour — three-band heat scale anchored to existing palette tokens.
  const matrixCellBg = (avgRisk) => {
    if (avgRisk < 33) return 'var(--primary-container)';
    if (avgRisk < 66) return 'var(--warning-container)';
    return 'var(--danger-container)';
  };
  const matrixCellAccent = (avgRisk) => {
    if (avgRisk < 33) return 'var(--primary)';
    if (avgRisk < 66) return 'var(--warning)';
    return 'var(--danger)';
  };

  return (
    <div className="glass-card table-view-container" style={{ padding: '0', display: 'flex', flexDirection: 'column' }}>

      <div className="card-title-row">
        <div>
          <h2>
            <Activity color="var(--primary)" size={26} /> Cohort Overview
            <InfoTip text={tips.cohort_overview.text} size={16} />
          </h2>
          <p>Filtered cohort summary and exploratory analysis</p>
        </div>
      </div>

      <CohortFilterBar
        data={data}
        filters={filters}
        updateFilters={updateFilters}
        clearAllFilters={clearAllFilters}
        variant="eda"
        topDriverLabel={aggregatedDrivers[0]?.label}
        onJumpToPredictions={onJumpToPredictions}
      />

      <div style={{ padding: '3rem' }}>

        {filteredData.length === 0 ? (
          <div style={{ marginBottom: '3rem' }}>
            <EmptyState
              icon={Search}
              title="No patients match these filters"
              description="Try removing the most restrictive filter, or clear them all to start exploring again."
              action={{ label: 'Clear all filters', onClick: clearAllFilters }}
            />
          </div>
        ) : (<>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem', marginBottom: '3rem' }}>

          <div className="stat-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span className="label" style={{ display: 'inline-flex', alignItems: 'center' }}>
                Active Filter Cohort
                <InfoTip text={tips.active_filter_cohort.text} size={13} />
              </span>
              <Users size={20} color="var(--primary)" />
            </div>
            <div className="value" style={{ fontSize: '3rem' }}>{Math.round(tweenedCohortCount).toLocaleString()}</div>
            <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-muted)' }}>
              {filtersActive ? activeFilterSummary : 'All patients in cohort'}
            </p>
          </div>

          <div className="stat-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span className="label" style={{ display: 'inline-flex', alignItems: 'center' }}>
                Avg. Admission Risk
                <InfoTip text={tips.avg_admission_risk.text} detail={tips.avg_admission_risk.detail} size={13} />
              </span>
              <TrendingUp size={20} color="var(--primary)" />
            </div>
            <div className="value" style={{ fontSize: '3rem' }}>
              {tweenedAvgRisk.toFixed(1)}<span style={{ fontSize: '0.5em', marginLeft: '0.1em' }}>%</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-muted)' }}>
              {filtersActive
                ? `${metrics.avgRisk >= globalAvgRisk ? '↑' : '↓'} ${Math.abs(metrics.avgRisk - globalAvgRisk).toFixed(1)} pts vs all ${data.length.toLocaleString()} patients`
                : `Across all ${data.length.toLocaleString()} patients`}
            </p>
          </div>

          <div className="stat-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span className="label" style={{ display: 'inline-flex', alignItems: 'center' }}>
                Readmission Conversion Rate
                <InfoTip text={tips.readmit_conversion.text} detail={tips.readmit_conversion.detail} size={13} />
              </span>
              <AlertTriangle size={20} color="var(--warning)" />
            </div>
            <div className="value" style={{ fontSize: '3rem', color: 'var(--warning)' }}>
              {tweenedReadmitRate.toFixed(1)}<span style={{ fontSize: '0.5em', marginLeft: '0.1em' }}>%</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-muted)' }}>
              Percent of the {metrics.totalAdmitted.toLocaleString()} admitted expected to readmit
            </p>
          </div>
        </div>

        <h2 style={{ paddingTop: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.5rem', marginBottom: '2.5rem' }}>
          <TrendingUp color="var(--primary)" size={24} /> Cohort Distribution
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2.5rem', marginBottom: '4rem' }}>

          {/* Age band bar chart — clickable for cross-filter */}
          <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '1.25rem', border: '1px solid var(--border-light)', boxShadow: 'var(--glass-shadow)' }}>
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={16} color="var(--primary)" /> Admission Risk by Age Band
              <InfoTip text={tips.age_band_chart.text} size={13} />
            </h3>
            <div style={{ width: '100%', height: '280px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ageRiskData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => v + '%'} />
                  <Tooltip
                    cursor={{ fill: 'rgba(120,120,120,0.05)' }}
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '12px', color: 'var(--text-main)' }}
                    content={({ active, payload }) => active && payload?.[0]?.payload ? (
                      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '0.65rem 0.85rem', fontSize: '0.85rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>Age {payload[0].payload.name}</div>
                        <div style={{ color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          {payload[0].payload.count.toLocaleString()} patients · avg risk {payload[0].payload.avgRisk.toFixed(1)}%
                        </div>
                        <div style={{ color: 'var(--primary)', marginTop: '0.4rem', fontSize: '0.78rem' }}>
                          Click to {filters.ageBand === payload[0].payload.name ? 'clear filter' : 'filter cohort'}
                        </div>
                      </div>
                    ) : null}
                  />
                  <Bar
                    dataKey="avgRisk"
                    barSize={36}
                    radius={[6, 6, 0, 0]}
                    onClick={(d) => onAgeBandClick(d.name)}
                    cursor="pointer"
                    animationDuration={400}
                  >
                    <LabelList
                      dataKey="count"
                      position="top"
                      formatter={(v) => v > 0 ? v.toLocaleString() : ''}
                      style={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}
                    />
                    {ageRiskData.map((entry, index) => (
                      <Cell
                        key={`age-cell-${index}`}
                        fill={filters.ageBand === entry.name ? 'var(--danger)' : 'var(--primary)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cohort drivers */}
          <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '1.25rem', border: '1px solid var(--border-light)', boxShadow: 'var(--glass-shadow)' }}>
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldAlert size={16} color="var(--danger)" /> Most-Cited Risk Drivers (Cohort)
              <InfoTip text={tips.cohort_drivers.text} detail={tips.cohort_drivers.detail} size={13} />
            </h3>
            <div style={{ width: '100%', height: '280px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aggregatedDrivers} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-light)" />
                  <XAxis type="number" stroke="var(--text-muted)" fontSize={11} tickFormatter={val => val} axisLine={false} tickLine={false} hide />
                  <YAxis dataKey="label" type="category" width={200} tick={{ fill: 'var(--text-main)', fontSize: '0.75rem' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(120,120,120,0.05)' }}
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '12px', color: 'var(--text-main)' }}
                    formatter={(value) => {
                      const pct = filteredData.length > 0 ? (value / filteredData.length) * 100 : 0;
                      return [`${value.toLocaleString()} patients (${pct.toFixed(1)}% of cohort)`, 'Leading Influence'];
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={14} animationDuration={400}>
                    {aggregatedDrivers.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={'url(#panelGradientGlobalX)'} />
                    ))}
                  </Bar>
                  <defs>
                    <linearGradient id="panelGradientGlobalX" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="var(--warning)" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="var(--danger)" stopOpacity={1} />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Admission-risk distribution histogram — clickable for cross-filter */}
          <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '1.25rem', border: '1px solid var(--border-light)', boxShadow: 'var(--glass-shadow)' }}>
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart2 size={16} color="var(--primary)" /> Admission Risk Distribution
              <InfoTip text={tips.risk_distribution.text} detail={tips.risk_distribution.detail} size={13} />
            </h3>
            <div style={{ width: '100%', height: '280px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={riskHistogramData} margin={{ top: 24, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                  <XAxis
                    type="number"
                    dataKey="binMid"
                    domain={[0, 100]}
                    ticks={[0, 20, 40, 60, 80, 100]}
                    tickFormatter={v => v + '%'}
                    stroke="var(--text-muted)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <Tooltip
                    cursor={{ fill: 'rgba(120,120,120,0.05)' }}
                    content={({ active, payload }) => active && payload?.[0]?.payload ? (
                      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '0.65rem 0.85rem', fontSize: '0.85rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{payload[0].payload.name}</div>
                        <div style={{ color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          {payload[0].payload.count.toLocaleString()} patients · {payload[0].payload.pct.toFixed(1)}% of cohort
                        </div>
                        <div style={{ color: 'var(--primary)', marginTop: '0.4rem', fontSize: '0.78rem' }}>
                          Click to {filters.riskBand === payload[0].payload.name ? 'clear filter' : 'filter cohort'}
                        </div>
                      </div>
                    ) : null}
                  />
                  <Bar
                    dataKey="count"
                    barSize={28}
                    radius={[4, 4, 0, 0]}
                    onClick={(d) => onRiskBandClick(d.name)}
                    cursor="pointer"
                    animationDuration={400}
                  >
                    {riskHistogramData.map((entry, index) => (
                      <Cell
                        key={`hist-cell-${index}`}
                        fill={filters.riskBand === entry.name ? 'var(--danger)' : 'var(--primary)'}
                      />
                    ))}
                  </Bar>
                  <ReferenceLine
                    x={thresholds.admission * 100}
                    stroke="var(--danger)"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                    label={{ value: 'Threshold', position: 'top', fill: 'var(--danger)', fontSize: 11, fontWeight: 600 }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Severity × Sex matrix — clickable for cross-filter */}
          <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '1.25rem', border: '1px solid var(--border-light)', boxShadow: 'var(--glass-shadow)' }}>
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={16} color="var(--primary)" /> Severity × Sex Matrix
              <InfoTip text={tips.severity_sex_matrix.text} size={13} />
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr', gridTemplateRows: '36px repeat(3, 1fr)', gap: '6px', height: '244px' }}>
              <div />
              <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, alignSelf: 'center' }}>Male</div>
              <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, alignSelf: 'center' }}>Female</div>
              {['Severe', 'Moderate', 'Mild'].map(sev => (
                <Fragment key={sev}>
                  <div style={{ alignSelf: 'center', fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 600 }}>{sev}</div>
                  {['M', 'F'].map(sex => {
                    const cell = severitySexMatrix.cells[`${sev}-${sex}`];
                    const isActive = filters.severity === sev && filters.gender === sex;
                    return (
                      <button
                        key={sex}
                        type="button"
                        onClick={() => onMatrixCellClick(sev, sex)}
                        aria-pressed={isActive}
                        aria-label={`Filter to ${sev} severity, ${sex === 'M' ? 'Male' : 'Female'} (${cell.count.toLocaleString()} patients, ${cell.avgRisk.toFixed(1)}% avg risk)`}
                        style={{
                          background: matrixCellBg(cell.avgRisk),
                          borderRadius: '0.5rem',
                          padding: '0.85rem',
                          border: isActive ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          alignItems: 'center',
                          gap: '0.25rem',
                          cursor: 'pointer',
                          transition: 'var(--transition)',
                          fontFamily: 'Inter, sans-serif',
                          boxShadow: isActive ? '0 0 0 4px var(--primary-glow)' : 'none',
                        }}
                      >
                        <div style={{ fontSize: '1.4rem', fontFamily: 'Manrope, sans-serif', fontWeight: 700, color: 'var(--text-main)' }}>
                          {cell.count.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: matrixCellAccent(cell.avgRisk), fontWeight: 600 }}>
                          {cell.avgRisk.toFixed(1)}% avg risk
                        </div>
                      </button>
                    );
                  })}
                </Fragment>
              ))}
            </div>
            {severitySexMatrix.unknownSex > 0 && (
              <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {severitySexMatrix.unknownSex.toLocaleString()} patients with unknown sex not shown.
              </div>
            )}
          </div>

        </div>

        </>)}

      </div>
    </div>
  );
}
