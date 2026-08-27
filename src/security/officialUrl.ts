const EXPLICIT_PUBLIC_HOSTS = new Set([
  'wasteguide.or.kr',
  'www.wasteguide.or.kr',
]);

function isGovernmentHostname(hostname: string): boolean {
  return hostname === 'go.kr' || hostname.endsWith('.go.kr');
}

export function isAllowedOfficialUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    if (url.username || url.password) return false;
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    return isGovernmentHostname(hostname) || EXPLICIT_PUBLIC_HOSTS.has(hostname);
  } catch {
    return false;
  }
}
