import * as Icons from "../icons";

export const NAV_DATA = [
  {
    label: "MAIN MENU",
    items: [
      {
        title: "Dashboard",
        url: "/dashboard",
        icon: Icons.HomeIcon,
        items: [],
      },
      {
        title: "Administrators",
        url: "/dashboard/admins",
        icon: Icons.User,
        items: [],
      },
      {
        title: "Clients",
        url: "/dashboard/clients",
        icon: Icons.User,
        items: [],
      },
      {
        title: "Inventory",
        url: "/dashboard/inventory",
        icon: Icons.Table,
        items: [],
      },
      {
        title: "Orders & payments",
        url: "/dashboard/orders",
        icon: Icons.Table,
        items: [],
      },
      {
        title: "Production",
        url: "/dashboard/production",
        icon: Icons.Table,
        items: [],
      },
      {
        title: "Ledger",
        url: "/dashboard/ledger",
        icon: Icons.Table,
        items: [],
      },
      {
        title: "Expenses",
        url: "/dashboard/expenses",
        icon: Icons.Table,
        items: [],
      },
      {
        title: "Support & guideline",
        url: "/dashboard/support-guideline",
        icon: Icons.DocumentGuideIcon,
        items: [],
      },
    ],
  },
];
