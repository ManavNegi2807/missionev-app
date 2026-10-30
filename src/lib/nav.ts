export interface NavItem {
  step: string;
  label: string;
  href: string;
  /** Screen requires a completed registration (process 1.0). */
  requiresRegistration: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { step: "01", label: "Sign-in & Register", href: "/register", requiresRegistration: false },
  { step: "02", label: "Capture Trip", href: "/capture-trip", requiresRegistration: true },
  { step: "03", label: "Rewards & Redeem", href: "/rewards", requiresRegistration: true },
  { step: "04", label: "Analytics & Dashboards", href: "/analytics", requiresRegistration: true },
];

export const navForPath = (pathname: string) =>
  NAV_ITEMS.find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`)) ?? NAV_ITEMS[0];
