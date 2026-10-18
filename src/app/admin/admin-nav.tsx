/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import Link from "next/link";

const LINKS = [
  { href: "/admin", label: "People" },
  { href: "/admin/bugs", label: "Bug reports" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/messages", label: "Messages" },
  { href: "/admin/audit", label: "Audit" },
] as const;

export function AdminNav({ current }: { current: (typeof LINKS)[number]["href"] }) {
  return (
    <nav aria-label="Administration" className="flex flex-wrap gap-2 text-sm">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={link.href === current ? "page" : undefined}
          className={`rounded-md border border-border px-3 py-1.5 ${
            link.href === current ? "bg-surface-2 font-medium" : "text-muted hover:text-foreground"
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
