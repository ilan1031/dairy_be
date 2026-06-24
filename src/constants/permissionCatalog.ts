import type { PermissionAction, PermissionCatalog } from '../types/models';

export const DEFAULT_PERMISSION_ACTIONS: PermissionAction[] = ['view', 'create', 'edit', 'delete', 'export'];

export const DEFAULT_PERMISSION_CATALOG: PermissionCatalog = {
  pages: [
    { key: 'Dashboard', label: 'Dashboard', actions: ['view', 'export'], tabIndex: 0 },
    { key: 'Sales', label: 'Sales', actions: ['view', 'create', 'edit', 'delete', 'export'], tabIndex: 1 },
    { key: 'Bills', label: 'Bills', actions: ['view', 'edit', 'export'], tabIndex: 3 },
    { key: 'Inventory', label: 'Inventory', actions: ['view', 'create', 'edit', 'delete'], tabIndex: -1 },
    { key: 'Profiles', label: 'Profiles', actions: ['view', 'create', 'edit', 'delete', 'export'], tabIndex: 2 },
    { key: 'Reports', label: 'Reports', actions: ['view', 'export'], tabIndex: 4 },
    { key: 'Settings', label: 'Settings', actions: ['view', 'edit', 'export'], tabIndex: 5 },
  ],
  fields: {
    Sales: [
      { key: 'customerName', label: 'Customer Name' },
      { key: 'milkType', label: 'Milk Type' },
      { key: 'liters', label: 'Liters' },
      { key: 'ratePerLiter', label: 'Rate / Liter' },
      { key: 'totalAmount', label: 'Total Amount' },
      { key: 'paymentStatus', label: 'Payment Status' },
      { key: 'paymentType', label: 'Payment Type' },
      { key: 'location', label: 'Location' },
    ],
    Profiles: [
      { key: 'name', label: 'Name' },
      { key: 'phone', label: 'Phone' },
      { key: 'address', label: 'Address' },
      { key: 'notes', label: 'Notes' },
      { key: 'qrPreference', label: 'QR Preference' },
    ],
    Bills: [
      { key: 'totalAmount', label: 'Total Amount' },
      { key: 'paymentStatus', label: 'Payment Status' },
      { key: 'paymentType', label: 'Payment Type' },
    ],
    Inventory: [
      { key: 'cowLiters', label: 'Cow Liters' },
      { key: 'buffaloLiters', label: 'Buffalo Liters' },
      { key: 'a2Liters', label: 'A2 Liters' },
    ],
    Settings: [
      { key: 'billingConfig', label: 'Billing Config' },
      { key: 'priceConfig', label: 'Price Config' },
      { key: 'auditLogs', label: 'Audit Logs' },
    ],
    Dashboard: [
      { key: 'revenue', label: 'Revenue Stats' },
      { key: 'pendingPayments', label: 'Pending Payments' },
      { key: 'userFilter', label: 'User Filter' },
    ],
    Reports: [
      { key: 'salesSummary', label: 'Sales Summary' },
      { key: 'exportData', label: 'Export Data' },
    ],
  },
  updatedAt: Date.now(),
};
