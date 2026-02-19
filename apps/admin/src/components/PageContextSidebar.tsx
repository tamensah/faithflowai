'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

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

  const scanSections = useCallback(() => {
    const root = document.getElementById(rootId);
    if (!root) {
      setSections((current) => (current.length ? [] : current));
      setActiveId((current) => (current ? '' : current));
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
      if (heading.id !== id) {
        heading.id = id;
      }
      if (!heading.classList.contains('scroll-mt-24')) {
        heading.classList.add('scroll-mt-24');
      }
      return { id, label };
    });

    setSections((current) => {
      const sameLength = current.length === nextSections.length;
      const unchanged =
        sameLength &&
        current.every((section, index) => {
          const nextSection = nextSections[index];
          return section.id === nextSection.id && section.label === nextSection.label;
        });
      return unchanged ? current : nextSections;
    });
    setActiveId((current) => (current && nextSections.some((section) => section.id === current) ? current : nextSections[0]?.id ?? ''));
  }, [rootId]);

  useEffect(() => {
    scanSections();
    const root = document.getElementById(rootId);
    if (!root) return;
    const observer = new MutationObserver(() => scanSections());
    observer.observe(root, { childList: true, subtree: true });
    window.addEventListener('resize', scanSections);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', scanSections);
    };
  }, [rootId, scanSections]);

  useEffect(() => {
    if (!sectionIds.length) return;
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
    sectionIds.forEach((id) => {
      const heading = document.getElementById(id);
      if (heading) observer.observe(heading);
    });
    return () => observer.disconnect();
  }, [sectionIds]);

  useEffect(() => {
    if (!sectionIds.length) return;
    const hash = window.location.hash.replace('#', '');
    if (hash && sectionIds.includes(hash)) {
      setActiveId(hash);
    }
  }, [sectionIds]);

  if (sections.length < minSections) return null;

  return (
    <aside className="hidden lg:block lg:self-start">
      <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border border-border/70 bg-white/85 p-4 shadow-sm backdrop-blur">
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
