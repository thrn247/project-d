import React from 'react';

// Shared empty-state panel — replaces the three near-duplicate blocks that
// previously lived inline in EDAView, PredictionsDirectory (table), and
// PredictionsDirectory (grid). All visual styling lives in the
// .empty-state* classes in index.css; this component only composes the
// structure.
export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="empty-state">
      {Icon && <Icon size={48} className="empty-state__icon" />}
      <h3 className="empty-state__title">{title}</h3>
      {description && <p className="empty-state__description">{description}</p>}
      {action && (
        <button type="button" onClick={action.onClick} className="empty-state__action">
          {action.label}
        </button>
      )}
    </div>
  );
}
