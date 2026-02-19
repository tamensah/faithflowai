'use client';

import { PageContextSidebar } from './PageContextSidebar';

type PageSectionLayoutProps = {
  rootId: string;
  title: string;
  children: React.ReactNode;
  className?: string;
};

export function PageSectionLayout({
  rootId,
  title,
  children,
  className = 'space-y-8',
}: PageSectionLayoutProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_240px] xl:items-start">
      <div id={rootId} className={className}>
        {children}
      </div>
      <PageContextSidebar rootId={rootId} title={title} />
    </div>
  );
}
