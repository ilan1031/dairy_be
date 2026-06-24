export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'export';

export interface CatalogPage {
  key: string;
  label: string;
  actions: PermissionAction[];
  tabIndex?: number;
}

export interface CatalogField {
  key: string;
  label: string;
}

export interface PermissionCatalog {
  pages: CatalogPage[];
  fields: Record<string, CatalogField[]>;
  updatedAt: number;
}

export interface SharedAccessRights {
  sales: boolean;
  inventory: boolean;
  customers: boolean;
}

export interface DataAccessScope {
  mode: 'own' | 'all' | 'shared';
  sharedUserIds: string[];
  sharedRights?: SharedAccessRights;
}

export interface ResourceLimits {
  maxCustomers?: number | null;
  maxSales?: number | null;
  maxInventory?: number | null;
  allowedMilkTypes?: string[] | null;
}

export interface UserSubscription {
  plan: string;
  expiresAt?: number;
  dueDate?: number;
  paymentMessage?: string;
}

export interface UserProfile {
  displayName?: string;
  phone?: string;
  department?: string;
  notes?: string;
}

export interface PermissionSet {
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  allowedPages: string[];
  canUseSubscription?: boolean;
  canViewOthers?: boolean;
  pagePermissions?: Record<string, PermissionAction[]>;
  fieldPermissions?: Record<string, Record<string, boolean>>;
  dataAccessScope?: DataAccessScope;
  resourceLimits?: ResourceLimits;
}

export interface UserModel {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  subscription?: UserSubscription | null;
  permissions: PermissionSet;
  profile?: UserProfile;
  createdAt: number;
  updatedAt: number;
}

/** Internal storage only — never sent to clients */
export interface UserAuthRecord extends UserModel {
  passwordHash?: string;
}

export interface Profile {
  businessName: string;
  ownerName: string;
  mobileNumber: string;
  emailAddress: string;
  signupTimestamp: number;
  isLightTheme: boolean;
  language: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  qrPreference: string;
  address?: string;
  notes?: string;
  ownerUserId?: string;
  updatedAt: number;
}

export interface Sale {
  id: string;
  customerId: string;
  customerName: string;
  milkType: string;
  liters: number;
  ratePerLiter: number;
  totalAmount: number;
  paymentStatus: string;
  paymentType: string;
  location: string;
  ownerUserId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PriceConfig {
  milkType: string;
  currentPrice: number;
  updatedAt: number;
}

export interface PriceLog {
  id: string;
  milkType: string;
  oldPrice: number;
  newPrice: number;
  timestamp: number;
}

export interface MilkInventory {
  dateStr: string;
  cowLiters: number;
  buffaloLiters: number;
  a2Liters: number;
  customStocksRaw: string;
  ownerUserId?: string;
  updatedAt: number;
}

export interface BillingConfig {
  paymentMethods: Array<{
    code: string;
    label: string;
    color: string;
    icon: string;
    enabled: boolean;
    marksPending?: boolean;
    lockEdit?: boolean;
    lockDelete?: boolean;
  }>;
  volumePresets: number[];
  allowCustomRate: boolean;
  requireLocation: boolean;
  defaultLocation: string;
  showStockWarnings: boolean;
  maxVolume: number;
  volumeStep: number;
  updatedAt: number;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown> | null;
  createdAt: number;
}

export interface BootstrapData {
  profile: Profile | null;
  customers: Customer[];
  sales: Sale[];
  priceConfigs: PriceConfig[];
  priceLogs: PriceLog[];
  inventory: MilkInventory[];
  users: UserModel[];
  billingConfig: BillingConfig | null;
  auditLogs: AuditLogEntry[];
  permissionCatalog?: PermissionCatalog;
  sessionUser?: UserModel | null;
  isSuperAdmin?: boolean;
}

export const DAIRY_PAGES = ['Dashboard', 'Sales', 'Bills', 'Inventory', 'Profiles', 'Reports', 'Settings'] as const;

export interface SessionPayload {
  email: string;
  userId: string;
  role: string;
  isSuperAdmin: boolean;
  ts: number;
}

export interface AuthContext {
  email: string;
  userId: string;
  role: string;
  isSuperAdmin: boolean;
  user: UserModel | null;
}
