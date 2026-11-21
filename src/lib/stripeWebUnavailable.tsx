import type { PropsWithChildren } from 'react';

// @stripe/stripe-react-native has no web implementation. Keep non-payment
// Clubhouse workflows usable in Expo web without pretending a payment worked.
// Metro uses this module on web only; iOS/Android still load the real SDK.
export function StripeProvider({ children }: PropsWithChildren<Record<string, unknown>>) {
  return <>{children}</>;
}

const unavailable = async (..._args: unknown[]) => ({
  error: {
    code: 'Failed',
    message: 'Native card payments are not available in the browser preview. Use the Clubhouse iOS or Android app.',
  },
});
export function useStripe() {
  return {
    initPaymentSheet: unavailable,
    presentPaymentSheet: unavailable,
    handleNextAction: unavailable,
    handleNextActionForSetup: unavailable,
    handleURLCallback: unavailable,
  };
}
