import React from 'react';
import AdminClient from '@/components/admin/AdminClient';
import { isAdminAuthenticated } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  let authenticated = false;
  try {
    authenticated = await isAdminAuthenticated();
  } catch {
    authenticated = false;
  }

  return <AdminClient initialAuthenticated={authenticated} />;
}
