/**
 * Detects whether the app is running in preview (editor/test) or published (production).
 * Returns 'preview' or 'published'.
 */
export function getAppEnv() {
  const hostname = window.location.hostname;
  // Published custom domains: potbsupport.base44.app or any domain NOT matching preview patterns
  // Preview: localhost, 127.0.0.1, or preview.base44.app, *.dev.base44.app
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('preview.') ||
    hostname.includes('.dev.base44.app')
  ) {
    return 'preview';
  }
  return 'published';
}