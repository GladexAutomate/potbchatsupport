/**
 * Detects whether the app is running in preview (editor/test) or published (production).
 * Returns 'preview' or 'published'.
 */
export function getAppEnv() {
  const hostname = window.location.hostname;
  // Base44 preview runs on localhost or *.base44.app preview URLs
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.includes('.base44.app')
  ) {
    return 'preview';
  }
  return 'published';
}