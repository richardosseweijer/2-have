export type ModuleNavItem = {
  id: string;
  label: string;
  href: "/klanten" | "/artikelen" | "/offertes" | "/bestellingen" | "/inkoop" | "/projecten" | "/planning" | "/crew";
  later: boolean;
};

/** The shell reads this list. Adding a module to the nav is a registry change. */
export const moduleNav: ModuleNavItem[] = [
  { id: "customers", label: "Klanten", href: "/klanten", later: false },
  { id: "articles", label: "Artikelen", href: "/artikelen", later: false },
  { id: "quotes", label: "Offertes", href: "/offertes", later: false },
  { id: "orders", label: "Bestellingen", href: "/bestellingen", later: false },
  { id: "purchases", label: "Inkoop", href: "/inkoop", later: false },
  { id: "projects", label: "Projecten", href: "/projecten", later: false },
  { id: "planning", label: "Planning", href: "/planning", later: false },
  { id: "crew", label: "Crew", href: "/crew", later: false },
];
