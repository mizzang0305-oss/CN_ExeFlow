import Link from "next/link";

import { cn } from "@/lib/utils";

export type NavigationItem = {
  href: string;
  label: string;
};

type TopNavProps = {
  currentPath: string;
  items: NavigationItem[];
};

function isActivePath(currentPath: string, href: string) {
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export function TopNav({ currentPath, items }: TopNavProps) {
  return (
    <nav className="flex w-full flex-wrap gap-2 xl:justify-end">
      {items.map((item) => {
        const isActive = isActivePath(currentPath, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex min-h-11 min-w-[9.75rem] flex-1 items-center justify-center rounded-[20px] px-4 py-2.5 text-sm font-semibold tracking-[-0.01em] whitespace-nowrap transition duration-200 sm:flex-none",
              isActive
                ? "bg-[linear-gradient(135deg,var(--color-brand-900),var(--color-brand-700))] text-white shadow-[0_18px_36px_rgba(3,19,38,0.34)] ring-1 ring-white/14"
                : "border border-brand-100/90 bg-white text-brand-900 shadow-[0_12px_24px_rgba(3,19,38,0.08)] hover:-translate-y-0.5 hover:bg-brand-50",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
