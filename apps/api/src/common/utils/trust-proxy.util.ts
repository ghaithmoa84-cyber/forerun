/**
 * Resolves the Express 'trust proxy' setting from an environment string.
 * If the string represents a valid number (e.g. "1"), it is parsed to a number
 * so that Express trusts the numeric hop count rather than treating the string as an IP address.
 */
export function resolveTrustProxySetting(
  rawTrustProxy?: string,
): number | string | boolean {
  if (rawTrustProxy && rawTrustProxy !== 'false') {
    const numericTrustProxy = Number(rawTrustProxy);
    return isNaN(numericTrustProxy) ? rawTrustProxy : numericTrustProxy;
  }
  return false;
}
