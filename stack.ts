import "server-only";
import { StackServerApp } from "@stackframe/stack";

/**
 * Server-side handle to Neon Auth (Stack).
 * Reads NEXT_PUBLIC_STACK_PROJECT_ID, NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY
 * and STACK_SECRET_SERVER_KEY from the environment automatically.
 */
export const stackServerApp = new StackServerApp({
  tokenStore: "nextjs-cookie",
  // This app does not use Stack's hosted analytics or session replay. Disabling
  // the client event tracker prevents background telemetry requests from
  // producing noisy "EventTracker flush failed" browser warnings.
  analytics: { enabled: false },
  urls: {
    home: "/",
    signIn: "/handler/sign-in",
    afterSignIn: "/collection",
    afterSignUp: "/collection",
    afterSignOut: "/",
  },
});
