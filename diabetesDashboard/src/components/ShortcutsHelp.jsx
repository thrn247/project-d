import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Keyboard, X } from 'lucide-react';

// Lightweight keyboard-shortcut reference. Triggered by `?` global keybinding
// (suppressed when typing in inputs). Esc closes; Tab cycles focus inside.
//
// Step 5 will add Arrow Left / Right entries once slideout sibling navigation
// is wired.
const SHORTCUTS = [
  { keys: ['Ctrl/Cmd', 'K'], description: 'Open command palette' },
  { keys: ['?'],              description: 'Show this dialog' },
  { keys: ['Esc'],            description: 'Close any dialog or panel' },
  { keys: ['Tab'],            description: 'Move focus forward' },
  { keys: ['Shift', 'Tab'],   description: 'Move focus backward' },
  { keys: ['Enter'],          description: 'Open the focused patient row' },
  { keys: ['Space'],          description: 'Open the focused patient row' },
];

export default function ShortcutsHelp({ open, onOpenChange }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="radix-dialog-overlay" />
        <Dialog.Content className="radix-dialog-content shortcuts-dialog" aria-describedby={undefined}>
          <div className="dialog-header">
            <Dialog.Title asChild>
              <h2 className="dialog-h2 dialog-h2--with-icon">
                <Keyboard size={22} color="var(--primary)" /> Keyboard shortcuts
              </h2>
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="icon-btn" aria-label="Close shortcuts">
                <X size={20} />
              </button>
            </Dialog.Close>
          </div>

          <ul className="shortcuts-list">
            {SHORTCUTS.map(({ keys, description }) => (
              <li key={description}>
                <span className="shortcut-keys">
                  {keys.map((k, i) => (
                    <React.Fragment key={k}>
                      <kbd>{k}</kbd>
                      {i < keys.length - 1 && <span className="shortcut-plus">+</span>}
                    </React.Fragment>
                  ))}
                </span>
                <span className="shortcut-desc">{description}</span>
              </li>
            ))}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
