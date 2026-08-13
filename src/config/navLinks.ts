export interface NavLink {
  label: string;
  to: string;
}

// central configuration for navigation; used by Navbar and any other menu
// v0.1 — navigation surfaces only real, API-backed features.
// Static-content pages (Learn/Program/Blogs/etc.) are hidden until they are backed by real data.
export const navLinks: NavLink[] = [
  { label: "Home", to: "/" },
  { label: "Scan", to: "/scan" },
  { label: "Labs", to: "/lab" },
  { label: "ZORVIX", to: "/assistant" },
  { label: "Dashboard", to: "/dashboard" },
];
