export interface NavLink {
  label: string;
  to: string;
}

// central configuration for navigation; used by Navbar and any other menu
export const navLinks: NavLink[] = [
  { label: "Home", to: "/" },
  { label: "Tools", to: "/tools" },
  { label: "Learn", to: "/learn" },
  { label: "Labs", to: "/lab" },
  { label: "News", to: "/blog" },
  { label: "Resources", to: "/resources" },
  { label: "Community", to: "/community" },
  { label: "Dashboard", to: "/dashboard" },
];
