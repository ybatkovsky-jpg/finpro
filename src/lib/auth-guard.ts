import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

/**
 * Get the current authenticated user from the session.
 * Returns null if not authenticated.
 */
export async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  return session?.user ?? null
}

/**
 * Require that the current user has one of the specified roles.
 * Throws an error if the user is not authenticated or not in the required role.
 */
export async function requireRole(...roles: string[]) {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error("Требуется авторизация")
  }

  if (!roles.includes(user.role)) {
    throw new Error("Недостаточно прав для выполнения действия")
  }

  return user
}

/**
 * Check if a user can access a specific project based on their role.
 *
 * - owner: full access to everything
 * - accountant: full read access to all projects
 * - manager: can access own projects + all projects for read
 * - storekeeper: read-only for all projects
 */
export function canAccessProject(
  userId: string,
  role: string,
  projectManagerId: string | null
): { canRead: boolean; canWrite: boolean } {
  switch (role) {
    case "owner":
      return { canRead: true, canWrite: true }
    case "accountant":
      return { canRead: true, canWrite: true }
    case "manager":
      // Manager can read all projects, but can only write to their own
      return {
        canRead: true,
        canWrite: projectManagerId === userId,
      }
    case "storekeeper":
      return { canRead: true, canWrite: false }
    default:
      return { canRead: false, canWrite: false }
  }
}

/**
 * Get role-based permissions for the UI.
 * Used to determine which actions are available in the interface.
 */
export function getRolePermissions(role: string) {
  switch (role) {
    case "owner":
      return {
        canCreateUser: true,
        canDeleteUser: true,
        canCreateProject: true,
        canEditProject: true,
        canDeleteProject: true,
        canCreateTransaction: true,
        canEditTransaction: true,
        canDeleteTransaction: true,
        canImport: true,
        canViewReports: true,
        canManageCategories: true,
        canManageCounterparties: true,
        canViewDashboard: true,
      }
    case "accountant":
      return {
        canCreateUser: false,
        canDeleteUser: false,
        canCreateProject: true,
        canEditProject: true,
        canDeleteProject: false,
        canCreateTransaction: true,
        canEditTransaction: true,
        canDeleteTransaction: true,
        canImport: true,
        canViewReports: true,
        canManageCategories: true,
        canManageCounterparties: true,
        canViewDashboard: true,
      }
    case "manager":
      return {
        canCreateUser: false,
        canDeleteUser: false,
        canCreateProject: true,
        canEditProject: true, // own projects only — enforced at query level
        canDeleteProject: false,
        canCreateTransaction: true,
        canEditTransaction: true, // own transactions only
        canDeleteTransaction: false,
        canImport: false,
        canViewReports: true,
        canManageCategories: false,
        canManageCounterparties: false,
        canViewDashboard: true,
      }
    case "storekeeper":
      return {
        canCreateUser: false,
        canDeleteUser: false,
        canCreateProject: false,
        canEditProject: false,
        canDeleteProject: false,
        canCreateTransaction: false,
        canEditTransaction: false,
        canDeleteTransaction: false,
        canImport: false,
        canViewReports: true,
        canManageCategories: false,
        canManageCounterparties: false,
        canViewDashboard: true,
      }
    default:
      return {
        canCreateUser: false,
        canDeleteUser: false,
        canCreateProject: false,
        canEditProject: false,
        canDeleteProject: false,
        canCreateTransaction: false,
        canEditTransaction: false,
        canDeleteTransaction: false,
        canImport: false,
        canViewReports: false,
        canManageCategories: false,
        canManageCounterparties: false,
        canViewDashboard: false,
      }
  }
}

/**
 * Build a Prisma where clause filter for row-level security on projects.
 * - owner/accountant: see all projects
 * - manager: see all projects (but write restricted to own)
 * - storekeeper: see all projects (read-only)
 */
export function getProjectFilter(userId: string, role: string) {
  if (role === "owner" || role === "accountant" || role === "manager" || role === "storekeeper") {
    return {} // All roles can read all projects
  }
  return { managerId: userId }
}

/**
 * Build a Prisma where clause filter for row-level security on transactions.
 * - owner/accountant: see all transactions
 * - manager: see all transactions (but write restricted to own)
 * - storekeeper: see all transactions (read-only)
 */
export function getTransactionFilter(userId: string, role: string) {
  if (role === "owner" || role === "accountant" || role === "manager" || role === "storekeeper") {
    return {} // All roles can read all transactions
  }
  return { createdBy: userId }
}
