import { adminSession, requireRole, type AdminSession } from './db';

export async function requireOfficeStaffSession(): Promise<AdminSession> {
  const session = await adminSession();
  requireRole(session, 'master_admin', 'office_staff');
  return session;
}

export async function requireMasterAdminSession(): Promise<AdminSession> {
  const session = await adminSession();
  requireRole(session, 'master_admin');
  return session;
}

export function authErrorResponse(error: unknown): { status: 401 | 403; message: string } {
  if (error instanceof Error) {
    if (error.message === 'FORBIDDEN') return { status: 403, message: 'Нямате достъп.' };
    if (error.message === 'NOT_AUTHENTICATED') return { status: 401, message: 'Неоторизиран достъп' };
    if (error.message === 'NOT_ADMIN') return { status: 403, message: 'Нямате достъп.' };
  }
  return { status: 401, message: 'Неоторизиран достъп' };
}
