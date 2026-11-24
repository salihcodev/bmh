import { Redirect } from 'expo-router';

/** Old Manage hub. The dashboard shell replaced it (DASH-01). */
export default function ManageRedirect() {
  return <Redirect href="/dashboard" />;
}
