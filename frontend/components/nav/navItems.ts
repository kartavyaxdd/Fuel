export type NavItem = {
  href: string;
  label: string;
  /** Compact label for the mobile bottom bar. */
  short: string;
  /** Inline SVG path data rendered at 24x24. */
  icon: string;
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    short: "Home",
    icon: "M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5",
  },
  {
    href: "/food",
    label: "Food Log",
    short: "Food",
    icon: "M4 3v7a3 3 0 0 0 3 3v8M7 3v7M10 3v7M17 3c-1.5 1-2 3-2 6s.5 4 2 5v7",
  },
  {
    href: "/weight",
    label: "Weight",
    short: "Weight",
    icon: "M4 20h16M6 20V9l6-5 6 5v11M9 20v-6h6v6",
  },
  {
    href: "/progress",
    label: "Progress",
    short: "Progress",
    icon: "M4 19V5M4 19h16M8 16l3-4 3 2 4-6",
  },
  {
    href: "/insights",
    label: "Insights",
    short: "Insights",
    icon: "M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.2 1 2V17h6v-1.5c0-.8.4-1.4 1-2A6 6 0 0 0 12 3ZM9.5 21h5",
  },
  {
    href: "/coach",
    label: "AI Coach",
    short: "Coach",
    icon: "M12 3a4 4 0 0 1 4 4v1a4 4 0 0 1-8 0V7a4 4 0 0 1 4-4ZM5 21v-1a7 7 0 0 1 14 0v1",
  },
];
