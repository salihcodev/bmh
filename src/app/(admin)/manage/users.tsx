import { Redirect, useLocalSearchParams } from 'expo-router';

/** Old users list. Filters move to the dashboard users module. */
export default function UsersRedirect() {
  const { status } = useLocalSearchParams<{ status?: string }>();
  return <Redirect href={{ pathname: '/dashboard/users', params: status ? { status } : {} }} />;
}
