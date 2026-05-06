import React, { useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import {
  Activity, BarChart2, User, AlertTriangle, Flame, CircleDot, X,
} from 'lucide-react';
import { EMPTY_FILTERS } from '../filters';

// Global Cmd/Ctrl+K palette: tab switching, patient ID lookup, filter presets,
// and slideout-aware actions when a patient panel is open. cmdk handles
// keyboard navigation; we control the input value so we can do our own
// patient-prefix filtering against 62k IDs (rendering all 62k as cmdk Items
// would be far too heavy — we filter to top 10 matches in JS instead).

const FILTER_PRESETS = [
  { label: 'Severe risk only',           filters: { severity: 'Severe' },             icon: Flame },
  { label: 'Moderate risk only',         filters: { severity: 'Moderate' },           icon: AlertTriangle },
  { label: 'Mild risk only',             filters: { severity: 'Mild' },               icon: CircleDot },
  { label: 'Male patients',              filters: { gender: 'M' },                    icon: User },
  { label: 'Female patients',            filters: { gender: 'F' },                    icon: User },
  { label: 'High admission risk (80–90%)', filters: { riskBand: '80-90%' },           icon: AlertTriangle },
  { label: 'Maximum admission risk (90–100%)', filters: { riskBand: '90-100%' },      icon: AlertTriangle },
];

export default function CommandPalette({
  open,
  onOpenChange,
  data,
  setActiveTab,
  setFilters,
  clearAllFilters,
  openSlideOut,
  slideoutOpen,
  onSlideoutClose,
}) {
  const [search, setSearch] = useState('');

  // Reset search alongside the open transition so the next open starts empty.
  // We intercept onOpenChange instead of using an effect (avoids the
  // react-hooks/set-state-in-effect lint).
  const handleOpenChange = (next) => {
    if (!next) setSearch('');
    onOpenChange(next);
  };

  // Top-10 patient prefix matches. We don't memo on `data` length alone — we
  // memo on the data ref so a new payload triggers re-index. With 62k rows
  // an in-memory includes() is ~3-5ms even on cold cache.
  const patientMatches = useMemo(() => {
    if (search.trim().length < 2) return [];
    const q = search.toUpperCase().trim();
    const out = [];
    for (let i = 0; i < data.length && out.length < 10; i++) {
      if (data[i].Patient_ID.toUpperCase().includes(q)) {
        out.push(data[i]);
      }
    }
    return out;
  }, [data, search]);

  const closePalette = () => handleOpenChange(false);

  const goToTab = (tab) => {
    setActiveTab(tab);
    closePalette();
  };

  const applyPreset = (preset) => {
    setFilters({ ...EMPTY_FILTERS, ...preset });
    closePalette();
  };

  const onSelectPatient = (patient) => {
    setActiveTab('predictions');
    openSlideOut(patient);
    closePalette();
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="radix-dialog-overlay" />
        <Dialog.Content className="cmdk-shell" aria-describedby={undefined}>
          <Dialog.Title style={{
            position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
            overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', borderWidth: 0,
          }}>
            Command palette
          </Dialog.Title>
          <Command label="Command palette" shouldFilter={false} className="cmdk-root">
            <div className="cmdk-input-wrap">
              <Command.Input
                value={search}
                onValueChange={setSearch}
                placeholder="Search patient ID, run an action…"
                className="cmdk-input"
              />
              <kbd className="cmdk-esc-hint">Esc</kbd>
            </div>
            <Command.List className="cmdk-list">
              <Command.Empty className="cmdk-empty">
                No matches. Type a patient ID (P00001) or pick an action below.
              </Command.Empty>

              {patientMatches.length > 0 && (
                <Command.Group heading="Patients" className="cmdk-group">
                  {patientMatches.map(p => (
                    <Command.Item
                      key={p.Patient_ID}
                      value={`patient-${p.Patient_ID}`}
                      onSelect={() => onSelectPatient(p)}
                      className="cmdk-item"
                    >
                      <User size={14} />
                      <span className="cmdk-item-main">{p.Patient_ID}</span>
                      <span className="cmdk-item-meta">
                        {p.Age} yrs • {p.Sex} • {p.Severity}
                      </span>
                      <span className="cmdk-item-meta cmdk-item-meta--score">
                        {(p.Stage_1_Admission_Risk * 100).toFixed(0)}% adm
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              <Command.Group heading="Switch view" className="cmdk-group">
                <Command.Item value="goto-eda" onSelect={() => goToTab('eda')} className="cmdk-item">
                  <Activity size={14} />
                  <span className="cmdk-item-main">Cohort Overview</span>
                  <kbd className="cmdk-shortcut">Ctrl 1</kbd>
                </Command.Item>
                <Command.Item value="goto-predictions" onSelect={() => goToTab('predictions')} className="cmdk-item">
                  <BarChart2 size={14} />
                  <span className="cmdk-item-main">Patient Predictions</span>
                  <kbd className="cmdk-shortcut">Ctrl 2</kbd>
                </Command.Item>
              </Command.Group>

              <Command.Group heading="Filter presets" className="cmdk-group">
                {FILTER_PRESETS.map(preset => {
                  const Icon = preset.icon;
                  return (
                    <Command.Item
                      key={preset.label}
                      value={`preset-${preset.label}`}
                      onSelect={() => applyPreset(preset.filters)}
                      className="cmdk-item"
                    >
                      <Icon size={14} />
                      <span className="cmdk-item-main">{preset.label}</span>
                    </Command.Item>
                  );
                })}
                <Command.Item
                  value="preset-clear"
                  onSelect={() => { clearAllFilters(); closePalette(); }}
                  className="cmdk-item"
                >
                  <X size={14} />
                  <span className="cmdk-item-main">Clear all filters</span>
                </Command.Item>
              </Command.Group>

              {slideoutOpen && (
                <Command.Group heading="Patient panel" className="cmdk-group">
                  <Command.Item
                    value="slideout-close"
                    onSelect={() => { onSlideoutClose(); closePalette(); }}
                    className="cmdk-item"
                  >
                    <X size={14} />
                    <span className="cmdk-item-main">Close patient panel</span>
                    <kbd className="cmdk-shortcut">Esc</kbd>
                  </Command.Item>
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
