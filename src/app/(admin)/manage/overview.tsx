import { Redirect } from 'expo-router';

/** Old platform overview. Counts and tenant records live on the dashboard. */
export default function OverviewRedirect() {
  return <Redirect href="/dashboard/records" />;
}
