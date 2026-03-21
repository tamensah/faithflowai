'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
} from '@faithflow-ai/ui';
import { getHelpForRoute, searchHelp, type HelpItem, type HelpSection } from './portal-help-content';

// ─── Accordion item ────────────────────────────────────────────────────────────

function HelpItemRow({ item }: { item: HelpItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-foreground">{item.q}</span>
        <span className="mt-0.5 shrink-0 text-muted">{open ? '−' : '+'}</span>
      </button>
      {open ? (
        <p className="pb-4 text-sm leading-relaxed text-muted">{item.a}</p>
      ) : null}
    </div>
  );
}

// ─── Section group ─────────────────────────────────────────────────────────────

function HelpSectionGroup({ section }: { section: HelpSection }) {
  return (
    <div className="mb-6">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted">
        {section.label}
      </p>
      <div className="rounded-xl border border-border bg-white px-4">
        {section.items.map((item) => (
          <HelpItemRow key={item.q} item={item} />
        ))}
      </div>
    </div>
  );
}

// ─── Trigger button (floating ?) ───────────────────────────────────────────────

export function HelpTriggerButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open help"
      className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-white text-sm font-semibold text-muted shadow-sm transition hover:border-primary/40 hover:text-primary"
    >
      ?
    </button>
  );
}

// ─── Main sheet ────────────────────────────────────────────────────────────────

export function PortalHelpSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const pathname = usePathname();
  const [query, setQuery] = useState('');

  const searchResults = searchHelp(query);
  const contextualSections = getHelpForRoute(pathname);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Help centre</SheetTitle>
          <SheetDescription>Answers to common questions about the member portal.</SheetDescription>
        </SheetHeader>

        <SheetBody className="flex-1 overflow-y-auto">
          {/* Search */}
          <div className="mb-5">
            <input
              type="search"
              placeholder="Search help…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Search results */}
          {query.trim() ? (
            searchResults.length > 0 ? (
              <div className="rounded-xl border border-border bg-white px-4">
                {searchResults.map((item) => (
                  <HelpItemRow key={item.q} item={item} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">No results for "{query}". Try a different word.</p>
            )
          ) : (
            // Contextual sections for the current page
            contextualSections.map((section) => (
              <HelpSectionGroup key={section.route} section={section} />
            ))
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
