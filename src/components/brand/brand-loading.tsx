import { Splash } from "./splash";

/** Route-level loading screen: the splash's finished frame, with a spinner if loading runs long. */
export function BrandLoading() {
  return <Splash mode="hold" spinner />;
}
