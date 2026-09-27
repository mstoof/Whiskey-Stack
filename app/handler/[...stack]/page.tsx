import { StackHandler } from "@stackframe/stack";
import { stackServerApp } from "@/stack";

/**
 * Catch-all route that renders every Neon Auth screen:
 * sign-in, magic-link / OTP, account settings, sign-out, etc.
 */
export default function Handler(props: unknown) {
  return <StackHandler fullPage app={stackServerApp} routeProps={props} />;
}
