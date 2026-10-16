/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { signOutAction } from "@/app/actions-auth";
import { Nav, type NavItem } from "@/components/nav";
import { buttonClass } from "@/components/ui";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { canManageMembers, canView, type Feature } from "@/domain/features";
import { allowedWhileUnapproved, canUseApp } from "@/domain/registration";
import { getAccount } from "@/lib/account";
import { getSession } from "@/lib/session";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Command Center", template: "%s · Command Center" },
  description: "Personal planning workspace",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [session, account] = await Promise.all([getSession(), getAccount()]);
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (account && !canUseApp(account.status) && pathname && !allowedWhileUnapproved(pathname)) {
    redirect("/pending");
  }

  const items: NavItem[] = [];
  if (session) {
    const { membership } = session;
    // A feature shows only if the workspace grants it AND the administrator granted it to this person.
    const allowed = (feature: Feature) =>
      canView(membership, feature) &&
      (!account || account.isAdmin || account.features.includes(feature));
    items.push({ href: "/", label: "Today" });
    if (allowed("calendar")) {
      items.push({ href: "/week", label: "Week" }, { href: "/semester", label: "Semester" });
    }
    if (allowed("study")) {
      items.push({ href: "/study", label: "Study" });
    }
    if (allowed("messages")) {
      items.push({ href: "/messages", label: "Messages" });
    }
    if (allowed("files")) {
      items.push({ href: "/files", label: "Files" });
    }
    if (allowed("widgets")) {
      items.push({ href: "/widgets", label: "Tools" });
    }
    if (canManageMembers(membership)) {
      items.push({ href: "/people", label: "People" });
    }
    if (account?.isAdmin) {
      items.push({ href: "/admin", label: "Admin" });
    }
  }

  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 z-10 border-b border-border bg-bg/90 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-sm font-semibold tracking-tight">Command Center</span>
              {session ? <Nav items={items} /> : null}
            </div>
            {session ? (
              <div className="flex items-center gap-3">
                <WorkspaceSwitcher workspaces={session.workspaces} activeId={session.active.id} />
                <form action={signOutAction}>
                  <button type="submit" className={buttonClass("quiet")}>
                    Sign out
                  </button>
                </form>
              </div>
            ) : account ? (
              <form action={signOutAction}>
                <button type="submit" className={buttonClass("quiet")}>
                  Sign out
                </button>
              </form>
            ) : null}
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
