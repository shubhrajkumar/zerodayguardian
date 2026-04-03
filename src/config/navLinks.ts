export interface NavLink {
  label: string;
  to: string;
}

// central configuration for navigation; used by Navbar and any other menu
export const navLinks: NavLink[] = [
  { label: "Home", to: "/" },
  { label: "Learn", to: "/learn" },
  { label: "Labs", to: "/lab" },
  { label: "ZORVIX", to: "/assistant" },
  { label: "Program", to: "/program" },
  { label: "Dashboard", to: "/dashboard" },
];
