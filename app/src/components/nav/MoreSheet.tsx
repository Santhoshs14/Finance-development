"use client";

import { usePathname, useRouter } from "next/navigation";
import { Bell, Calculator, Monitor, Moon, Settings, Sun } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { ListGroup, ListRow, SegmentedControl, Sheet } from "@/components/ui";
import { NAV_SECTIONS, findActiveNavPath } from "./nav-config";

const THEME_OPTIONS = [
  { value: "system" as const, label: "Auto", icon: Monitor },
  { value: "light" as const, label: "Light", icon: Sun },
  { value: "dark" as const, label: "Dark", icon: Moon },
];

const GENERAL_ITEMS = [
  { label: "Calculators", path: "/calculators", icon: Calculator, tint: "bg-chart-5" },
  { label: "Notifications", path: "/notifications", icon: Bell, tint: "bg-danger" },
  { label: "Settings", path: "/settings", icon: Settings, tint: "bg-muted-foreground" },
];

const GENERAL_PATHS = GENERAL_ITEMS.map((item) => item.path);

interface MoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Everything that doesn't fit in the tab bar, laid out like iOS Settings. */
export function MoreSheet({ open, onOpenChange }: MoreSheetProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();

  const close = () => onOpenChange(false);
  const activePath = findActiveNavPath(pathname, GENERAL_PATHS);
  const displayName = user?.displayName || user?.email?.split("@")[0] || "User";
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleSignOut = () => {
    close();
    signOut();
    router.push("/login");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="More" bodyClassName="space-y-6">
      <ListGroup>
        <ListRow
          href="/settings"
          onClick={close}
          leading={
            <span
              aria-hidden
              className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-accent text-base font-semibold text-white"
            >
              {initials}
            </span>
          }
          title={displayName}
          subtitle={user?.email}
          chevron
        />
      </ListGroup>

      {NAV_SECTIONS.filter((section) => section.label).map((section) => (
        <ListGroup key={section.id} title={section.label}>
          {section.items.map((item) => (
            <ListRow
              key={item.path}
              href={item.path}
              onClick={close}
              icon={item.icon}
              iconClassName={section.tint}
              title={item.label}
              active={item.path === activePath}
              chevron
            />
          ))}
        </ListGroup>
      ))}

      <ListGroup title="General">
        {GENERAL_ITEMS.map((item) => (
          <ListRow
            key={item.path}
            href={item.path}
            onClick={close}
            icon={item.icon}
            iconClassName={item.tint}
            title={item.label}
            active={item.path === activePath}
            chevron
          />
        ))}
      </ListGroup>

      <ListGroup title="Appearance">
        <div className="p-3">
          <SegmentedControl aria-label="Appearance" value={theme} onChange={setTheme} options={THEME_OPTIONS} />
        </div>
      </ListGroup>

      <ListGroup>
        <ListRow onClick={handleSignOut} title="Sign Out" destructive centered />
      </ListGroup>
    </Sheet>
  );
}
