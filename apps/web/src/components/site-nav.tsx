'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

type LinkItem = { href: string; label: string };

const mainLinks: LinkItem[] = [
  { href: '/features', label: 'Features' },
  { href: '/plans', label: 'Plans' },
  { href: '/about', label: 'About' },
  { href: '/guide', label: 'Guide' },
  { href: '/contact', label: 'Contact' },
];

// Shown in the mobile drawer under "Access"
const accessLinks: LinkItem[] = [
  { href: '/sign-in', label: 'Sign in' },
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

  return (
    <nav className="flex items-center">
      {/* Desktop — clean link list only */}
      <div className="hidden items-center gap-6 md:flex">
        {mainLinks.map(({ href, label }) => (
          <Link key={href} className={linkClasses(isRouteActive(pathname, href))} href={href}>
            {label}
          </Link>
        ))}
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
            <Link
              className={linkClasses(isRouteActive(pathname, '/'))}
              href="/"
              onClick={() => setOpen(false)}
            >
              Home
            </Link>
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
              <p className="mb-2 text-xs uppercase tracking-widest text-muted">Access</p>
              {accessLinks.map(({ href, label }) => (
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
