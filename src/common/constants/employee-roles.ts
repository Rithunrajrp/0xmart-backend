import { EmployeeRole, EmployeePermission } from '@prisma/client';

/**
 * Default permission mappings for each employee role
 * These are starting templates - permissions can be customized per employee
 */
export const EMPLOYEE_ROLE_PERMISSIONS: Record<
  EmployeeRole,
  EmployeePermission[]
> = {
  // Merchant Onboarding Team
  [EmployeeRole.MERCHANT_ONBOARDING]: [
    EmployeePermission.VIEW_MERCHANTS,
    EmployeePermission.APPROVE_MERCHANTS,
    EmployeePermission.REJECT_MERCHANTS,
    EmployeePermission.VIEW_PRODUCTS, // View merchant products
    EmployeePermission.VIEW_ORDERS, // View merchant order history
  ],

  // KYC Review Team
  [EmployeeRole.KYC_REVIEWER]: [
    EmployeePermission.VIEW_USERS,
    EmployeePermission.VIEW_KYC,
    EmployeePermission.APPROVE_KYC,
    EmployeePermission.REJECT_KYC,
  ],

  // Product Management Team
  [EmployeeRole.PRODUCT_MANAGER]: [
    EmployeePermission.VIEW_PRODUCTS,
    EmployeePermission.CREATE_PRODUCTS,
    EmployeePermission.EDIT_PRODUCTS,
    EmployeePermission.DELETE_PRODUCTS,
    EmployeePermission.VIEW_MERCHANTS, // See which merchant owns product
    EmployeePermission.VIEW_ANALYTICS, // Product performance
  ],

  // Inventory Management Team
  [EmployeeRole.INVENTORY_MANAGER]: [
    EmployeePermission.VIEW_PRODUCTS,
    EmployeePermission.VIEW_INVENTORY,
    EmployeePermission.UPDATE_INVENTORY,
    EmployeePermission.VIEW_ORDERS, // Check orders affecting inventory
    EmployeePermission.VIEW_MERCHANTS, // View merchant inventory
  ],

  // Customer Support Team
  [EmployeeRole.CUSTOMER_SUPPORT]: [
    EmployeePermission.VIEW_USERS,
    EmployeePermission.EDIT_USERS, // Update user profile on behalf of customer
    EmployeePermission.VIEW_ORDERS,
    EmployeePermission.EDIT_ORDERS, // Update shipping address, etc.
    EmployeePermission.CANCEL_ORDERS,
    EmployeePermission.VIEW_TICKETS,
    EmployeePermission.RESPOND_TICKETS,
    EmployeePermission.CLOSE_TICKETS,
    EmployeePermission.VIEW_WITHDRAWALS, // Check withdrawal status for customer
    EmployeePermission.VIEW_PRODUCTS, // Help customers find products
  ],
};

/**
 * Get default permissions for a role
 */
export function getDefaultPermissionsForRole(
  role: EmployeeRole,
): EmployeePermission[] {
  return EMPLOYEE_ROLE_PERMISSIONS[role] || [];
}

/**
 * Validate if a set of permissions is valid for a role
 */
export function arePermissionsValidForRole(
  role: EmployeeRole,
  permissions: EmployeePermission[],
): boolean {
  const defaultPermissions = getDefaultPermissionsForRole(role);

  // Check if all requested permissions are in the default set for this role
  // Note: SuperAdmin can assign any permissions, so this is just a helper
  return permissions.every((perm) => defaultPermissions.includes(perm));
}

/**
 * Permission descriptions for UI
 */
export const PERMISSION_DESCRIPTIONS: Record<EmployeePermission, string> = {
  [EmployeePermission.VIEW_USERS]: 'View user profiles and information',
  [EmployeePermission.EDIT_USERS]: 'Edit user profiles',
  [EmployeePermission.DELETE_USERS]: 'Delete user accounts',
  [EmployeePermission.VIEW_MERCHANTS]: 'View merchant/seller information',
  [EmployeePermission.APPROVE_MERCHANTS]: 'Approve merchant applications',
  [EmployeePermission.REJECT_MERCHANTS]: 'Reject merchant applications',
  [EmployeePermission.VIEW_KYC]: 'View KYC documents and status',
  [EmployeePermission.APPROVE_KYC]: 'Approve KYC verifications',
  [EmployeePermission.REJECT_KYC]: 'Reject KYC verifications',
  [EmployeePermission.VIEW_PRODUCTS]: 'View product listings',
  [EmployeePermission.CREATE_PRODUCTS]: 'Create new products',
  [EmployeePermission.EDIT_PRODUCTS]: 'Edit existing products',
  [EmployeePermission.DELETE_PRODUCTS]: 'Delete products',
  [EmployeePermission.VIEW_INVENTORY]: 'View inventory levels',
  [EmployeePermission.UPDATE_INVENTORY]: 'Update inventory quantities',
  [EmployeePermission.VIEW_ORDERS]: 'View customer orders',
  [EmployeePermission.EDIT_ORDERS]: 'Edit order details',
  [EmployeePermission.CANCEL_ORDERS]: 'Cancel customer orders',
  [EmployeePermission.VIEW_TICKETS]: 'View support tickets',
  [EmployeePermission.RESPOND_TICKETS]: 'Respond to support tickets',
  [EmployeePermission.CLOSE_TICKETS]: 'Close/resolve support tickets',
  [EmployeePermission.VIEW_WITHDRAWALS]: 'View withdrawal requests',
  [EmployeePermission.APPROVE_WITHDRAWALS]: 'Approve withdrawal requests',
  [EmployeePermission.VIEW_ANALYTICS]: 'View analytics and reports',
  [EmployeePermission.EXPORT_DATA]: 'Export data and reports',
};

/**
 * Role descriptions for UI
 */
export const ROLE_DESCRIPTIONS: Record<EmployeeRole, string> = {
  [EmployeeRole.MERCHANT_ONBOARDING]:
    'Reviews and approves merchant applications, grants access to merchant dashboard',
  [EmployeeRole.KYC_REVIEWER]:
    'Verifies customer identity documents and approves/rejects KYC submissions',
  [EmployeeRole.PRODUCT_MANAGER]:
    'Manages in-house product catalog, product display, and merchandising',
  [EmployeeRole.INVENTORY_MANAGER]:
    'Tracks and updates product stock levels in warehouse',
  [EmployeeRole.CUSTOMER_SUPPORT]:
    'Handles customer inquiries, tickets, and order-related issues',
};
