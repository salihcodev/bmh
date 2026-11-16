import { Redirect } from 'expo-router';

/** The name step now lives in onboarding; kept so old links still land in the right place. */
export default function CompleteProfileRedirect() {
  return <Redirect href="/onboarding?step=profile" />;
}
