'use client';

import { useEffect } from 'react';

type Shortcut = {
  key: string;
  onTrigger: () => void;
  shift?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  alt?: boolean;
  preventDefault?: boolean;
  enabled?: boolean;
};

function isEditableTarget(target: EventTarget | null) {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return target.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select';
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        if (shortcut.enabled === false) continue;

        const matchesKey = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const matchesShift = (shortcut.shift ?? false) === event.shiftKey;
        const matchesCtrl = (shortcut.ctrl ?? false) === event.ctrlKey;
        const matchesMeta = (shortcut.meta ?? false) === event.metaKey;
        const matchesAlt = (shortcut.alt ?? false) === event.altKey;

        if (!matchesKey || !matchesShift || !matchesCtrl || !matchesMeta || !matchesAlt) continue;
        if (isEditableTarget(event.target) && shortcut.key === '/') return;

        if (shortcut.preventDefault ?? true) {
          event.preventDefault();
        }
        shortcut.onTrigger();
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shortcuts]);
}
