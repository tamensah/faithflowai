'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

type LinkItem = { href: string; label: string };

const mainLinks: LinkItem[] = [
  { href: '/', label: 'Home' },
  { href: '/features', label: 'Features' },
  { href: '/plans', label: 'Plans' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

const portalLinks: LinkItem[] = [
  { href: '/sign-in', label: 'Sign in' },
  { href: '/sign-up', label: 'Create account' },
  { href: '/get-started', label: 'Church onboarding' },
  { href: '/portal', label: 'Member portal' },
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

  const portalActive = portalLinks.some((l) => isRouteActive(pathname, l.href));

  return (
    <nav className="flex items-center">
      {/* Desktop */}
      <div className="hidden items-center gap-5 md:flex">
        {mainLinks.map(({ href, label }) => (
          <Link key={href} className={linkClasses(isRouteActive(pathname, href))} href={href}>
            {label}
          </Link>
        ))}

        {/* Sign in / portal dropdown */}
        <div className="group relative">
          <button
            type="button"
            className={`${linkClasses(portalActive)} flex items-center gap-1`}
          >
            Sign in
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 opacity-60" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="pointer-events-none absolute right-0 top-full z-50 pt-2 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
            <div className="w-52 rounded-lg border border-border bg-white p-2 shadow-lg">
              {portalLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`block rounded-md px-3 py-2 text-sm ${
                    isRouteActive(pathname, href)
                      ? 'bg-muted/20 font-semibold text-foreground'
                      : 'text-muted hover:bg-muted/15 hover:text-foreground'
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile hamburger */}
      <div className="md:hidden">
        <button
          aria-controls="mobile-nav"
          aria-expanded={open}
          className="rounded-md border border-border px-3 py-1.5 text-sm"
          onClick={() => setOpen((v) => !v)}
          type="button"
        >
          {open ? 'Close' : 'Menu'}
        </button>
      </div>

      {open ? (
        <div
          className="absolute left-0 top-14 z-50 w-full border-b border-border bg-background px-4 pb-4 pt-3 shadow-sm md:hidden"
          id="mobile-nav"
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-3">
            {mainLinks.map(({ href, label }) => (
              <Link
                key={href}
                className={linkClasses(isRouteActive(pathname, href))}
                href={href}
                onClick={() => setOpen(false)}
              >
                {label}
              </Link>
            ))}
            <div className="border-t border-border pt-3">
              <p className="mb-2 text-xs uppercase tracking-widest text-muted">Your account</p>
              {portalLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  className={`block py-1 ${linkClasses(isRouteActive(pathname, href))}`}
                  href={href}
                  onClick={() => setOpen(false)}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </nav>
  );
}
