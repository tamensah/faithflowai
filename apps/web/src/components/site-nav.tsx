'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

type LinkItem = {
  href: string;
  label: string;
};

const existingUserLinks: LinkItem[] = [
  { href: '/get-started', label: 'Church onboarding' },
  { href: '/portal', label: 'Membership portal' },
  { href: '/events', label: 'Events' },
];

function linkClasses(isActive: boolean) {
  return isActive
    ? 'text-sm font-semibold text-foreground'
    : 'text-sm text-muted transition-colors hover:text-foreground';
}

function isRouteActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const existingActive =
    pathname === '/existing-users' || existingUserLinks.some((entry) => isRouteActive(pathname, entry.href));

  return (
    <nav className="flex items-center">
      <div className="hidden items-center gap-5 md:flex">
        <Link className={linkClasses(isRouteActive(pathname, '/'))} href="/">
          Home
        </Link>
        <Link className={linkClasses(isRouteActive(pathname, '/plans'))} href="/plans">
          Plans
        </Link>
        <div className="group relative">
          <Link className={linkClasses(existingActive)} href="/existing-users">
            Existing Users
          </Link>
          <div className="pointer-events-none absolute right-0 top-full z-50 pt-2 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
            <div className="w-56 rounded-lg border border-border bg-white p-2 shadow-lg">
              {existingUserLinks.map((entry) => (
                <Link
                  key={entry.href}
                  className={`block rounded-md px-3 py-2 text-sm ${isRouteActive(pathname, entry.href) ? 'bg-muted/20 font-semibold text-foreground' : 'text-muted hover:bg-muted/15 hover:text-foreground'}`}
                  href={entry.href}
                >
                  {entry.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
        <Link className={linkClasses(isRouteActive(pathname, '/about'))} href="/about">
          About
        </Link>
        <Link className={linkClasses(isRouteActive(pathname, '/contact'))} href="/contact">
          Contact
        </Link>
      </div>

      <div className="md:hidden">
        <button
          aria-controls="mobile-nav"
          aria-expanded={open}
          className="rounded-md border border-border px-3 py-1.5 text-sm"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          Menu
        </button>
      </div>

      {open ? (
        <div
          className="absolute left-0 top-14 z-50 w-full border-b border-border bg-background px-4 pb-4 pt-3 shadow-sm md:hidden"
          id="mobile-nav"
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-2">
            <Link className={linkClasses(isRouteActive(pathname, '/'))} href="/" onClick={() => setOpen(false)}>
              Home
            </Link>
            <Link className={linkClasses(isRouteActive(pathname, '/plans'))} href="/plans" onClick={() => setOpen(false)}>
              Plans
            </Link>
            <Link
              className={linkClasses(pathname === '/existing-users')}
              href="/existing-users"
              onClick={() => setOpen(false)}
            >
              Existing Users
            </Link>
            <div className="ml-3 flex flex-col gap-2 border-l border-border pl-3">
              {existingUserLinks.map((entry) => (
                <Link
                  key={entry.href}
                  className={linkClasses(isRouteActive(pathname, entry.href))}
                  href={entry.href}
                  onClick={() => setOpen(false)}
                >
                  {entry.label}
                </Link>
              ))}
            </div>
            <Link className={linkClasses(isRouteActive(pathname, '/about'))} href="/about" onClick={() => setOpen(false)}>
              About
            </Link>
            <Link
              className={linkClasses(isRouteActive(pathname, '/contact'))}
              href="/contact"
              onClick={() => setOpen(false)}
            >
              Contact
            </Link>
          </div>
        </div>
      ) : null}
    </nav>
  );
}
