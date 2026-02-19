'use client';

import { useEffect, useMemo, useState } from 'react';

type ContextSection = {
  id: string;
  label: string;
};

type PageContextSidebarProps = {
  rootId: string;
  title?: string;
  minSections?: number;
};

function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function PageContextSidebar({
  rootId,
  title = 'On this page',
  minSections = 2,
}: PageContextSidebarProps) {
  const [sections, setSections] = useState<ContextSection[]>([]);
  const [activeId, setActiveId] = useState('');

  const sectionIds = useMemo(() => sections.map((section) => section.id), [sections]);

  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) {
      setSections([]);
      setActiveId('');
      return;
    }

    const headings = Array.from(root.querySelectorAll<HTMLElement>('h2')).filter((heading) =>
      Boolean(heading.textContent?.trim())
    );
    const seen = new Map<string, number>();
    const nextSections: ContextSection[] = headings.map((heading, index) => {
      const label = heading.textContent?.trim() ?? `Section ${index + 1}`;
      const base = toSlug(heading.id || label) || `section-${index + 1}`;
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      const id = count > 0 ? `${base}-${count + 1}` : base;
      heading.id = id;
      heading.classList.add('scroll-mt-24');
      return { id, label };
    });

    setSections(nextSections);
    setActiveId((current) => (current && nextSections.some((section) => section.id === current) ? current : nextSections[0]?.id ?? ''));

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length) {
          setActiveId((visible[0].target as HTMLElement).id);
        }
      },
      { rootMargin: '-28% 0px -58% 0px', threshold: [0, 1] }
    );

    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [rootId]);

  useEffect(() => {
    if (!sectionIds.length) return;
    const hash = window.location.hash.replace('#', '');
    if (hash && sectionIds.includes(hash)) {
      setActiveId(hash);
    }
  }, [sectionIds]);

  if (sections.length < minSections) return null;

  return (
    <aside className="hidden xl:block">
      <div className="sticky top-24 rounded-2xl border border-border/70 bg-white/85 p-4 shadow-sm backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{title}</p>
        <nav className="mt-3 space-y-1.5">
          {sections.map((section) => {
            const isActive = section.id === activeId;
            return (
              <a
                key={section.id}
                href={`#${section.id}`}
                className={`block rounded-lg px-2.5 py-2 text-sm transition ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted hover:bg-slate-200/70 hover:text-foreground'
                }`}
              >
                {section.label}
              </a>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
