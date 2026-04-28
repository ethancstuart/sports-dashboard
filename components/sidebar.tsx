"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Radio,
  Search,
  Cpu,
  Database,
  Activity,
  Terminal,
  Sparkles,
  NotebookPen,
  FlaskConical,
  Bot,
  Wrench,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

const NAV = [
  { href: "/", label: "Daily Play", icon: LayoutDashboard },
  { href: "/lab", label: "Lab", icon: FlaskConical },
  { href: "/live", label: "Live", icon: Radio },
  { href: "/placements", label: "My Bets", icon: NotebookPen },
  { href: "/analyze", label: "Analyze", icon: Sparkles },
  { href: "/claude", label: "Claude Handicapper", icon: Bot },
  { href: "/builder", label: "Model Builder", icon: Wrench },
  { href: "/audit", label: "Prediction Audit", icon: Search },
  { href: "/models", label: "Model Registry", icon: Cpu },
  { href: "/data", label: "Data Observatory", icon: Database },
  { href: "/data/explorer", label: "Data Explorer", icon: Terminal },
  { href: "/pipeline", label: "Pipeline Control", icon: Activity },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed left-4 top-4 z-50 rounded-md bg-card p-2 lg:hidden"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen w-56 flex-col border-r border-sidebar-border bg-sidebar transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <div className="font-mono text-lg font-bold text-[var(--primary)]">
            EDGEWATCH
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-primary font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-4">
          <div className="text-xs text-muted-foreground">
            EdgeWatch v2.0
          </div>
        </div>
      </aside>
    </>
  );
}
