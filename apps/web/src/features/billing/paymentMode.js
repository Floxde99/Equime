/**
 * Mode de paiement exposé par l’API publique.
 * @typedef {{ provider: 'stripe' | 'simulated', mode: 'test' | 'live' }} PaymentConfig
 */

/**
 * @param {PaymentConfig | null | undefined} config
 * @returns {boolean}
 */
export function isPaymentTestMode(config) {
  return config?.mode === 'test';
}

/**
 * @param {PaymentConfig | null | undefined} config
 * @returns {boolean}
 */
export function isStripeCheckout(config) {
  return config?.provider === 'stripe';
}
