import { exec } from "node:child_process";

// Strict IPv4 validation to prevent command injection
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

function isValidIPv4(ip: string): boolean {
  if (!IPV4_RE.test(ip)) return false;
  return ip.split(".").every((octet) => parseInt(octet) <= 255);
}

/**
 * Ping a router IP using the system ping command.
 * Returns true if reachable, false otherwise.
 * Safe against command injection — validates IPv4 strictly.
 */
export function pingRouter(ip: string): Promise<boolean> {
  if (!isValidIPv4(ip)) return Promise.resolve(false);

  return new Promise((resolve) => {
    // Linux (Docker container) syntax: -c 1 count, -W 2 wait-seconds
    exec(`ping -c 1 -W 2 ${ip}`, (error) => {
      resolve(!error);
    });
  });
}

/**
 * Ping multiple IPs concurrently, returns a map of ip → reachable.
 */
export async function pingAll(
  ips: string[],
): Promise<Record<string, boolean>> {
  const results = await Promise.all(ips.map((ip) => pingRouter(ip)));
  return Object.fromEntries(ips.map((ip, i) => [ip, results[i]]));
}
