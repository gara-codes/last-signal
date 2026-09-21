// src/ui/menu-nav.js
//
// Selection handling for the vertical menus (main menu, pause). One row is "selected" at a
// time, and hover, arrow keys, Home/End and Tab focus all move that same selection, so two rows
// can never look highlighted at once. Rows marked disabled are skipped by the keyboard.
// Enter/Space activate the selected row natively because rows are real <button>s.

const SELECTED = 'is-selected';
const DISABLED = 'is-disabled';

/**
 * @param {HTMLElement} container element that holds the row buttons
 * @returns {{ select: (index: number) => void, selectFirstEnabled: () => void, refresh: () => void }}
 */
export function createMenuNav(container) {
  const rows = () => Array.from(container.querySelectorAll('.ui-menu-item'));
  const isEnabled = (row) => !row.classList.contains(DISABLED);

  function mark(row) {
    for (const other of rows()) other.classList.toggle(SELECTED, other === row);
  }

  function select(index) {
    const list = rows();
    const row = list[index];
    if (!row) return;
    mark(row);
    row.focus({ preventScroll: true });
  }

  function selectFirstEnabled() {
    const index = rows().findIndex(isEnabled);
    if (index >= 0) select(index);
  }

  function move(step) {
    const list = rows();
    const enabled = list.filter(isEnabled);
    if (enabled.length === 0) return;
    const current = enabled.indexOf(list.find((row) => row.classList.contains(SELECTED)));
    let next;
    if (current < 0) next = step > 0 ? enabled[0] : enabled[enabled.length - 1];
    else next = enabled[(current + step + enabled.length) % enabled.length];
    select(list.indexOf(next));
  }

  container.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const enabled = rows().filter(isEnabled);
      const target = event.key === 'Home' ? enabled[0] : enabled[enabled.length - 1];
      if (target) select(rows().indexOf(target));
    }
  });

  container.addEventListener('pointerover', (event) => {
    const row = event.target.closest?.('.ui-menu-item');
    if (row && isEnabled(row) && !row.classList.contains(SELECTED)) select(rows().indexOf(row));
  });

  container.addEventListener('focusin', (event) => {
    const row = event.target.closest?.('.ui-menu-item');
    if (row && isEnabled(row)) mark(row);
  });

  return {
    select,
    selectFirstEnabled,
    /** Call after rows are enabled/disabled: keeps the selection on an enabled row. */
    refresh() {
      const current = rows().find((row) => row.classList.contains(SELECTED));
      if (!current || !isEnabled(current)) selectFirstEnabled();
    },
  };
}

/** Mark a row enabled/disabled (visually and for assistive tech), with an optional reason. */
export function setRowEnabled(row, enabled, reason = '') {
  row.classList.toggle(DISABLED, !enabled);
  row.setAttribute('aria-disabled', String(!enabled));
  if (!enabled && reason) row.title = reason;
  else row.removeAttribute('title');
}
