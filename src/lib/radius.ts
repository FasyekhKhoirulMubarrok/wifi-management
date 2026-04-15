import { exec } from "child_process";
import { promisify } from "util";
import { db } from "./db";

const execAsync = promisify(exec);

export async function addRadiusUser(
  username: string,
  password: string,
  speedDownKbps: number,
  speedUpKbps: number
): Promise<void> {
  await db.$transaction([
    db.$executeRaw`
      INSERT INTO radcheck (username, attribute, op, value)
      VALUES (${username}, 'Cleartext-Password', ':=', ${password})
    `,
    db.$executeRaw`
      INSERT INTO radreply (username, attribute, op, value)
      VALUES (${username}, 'WISPr-Bandwidth-Max-Down', ':=', ${String(speedDownKbps * 1000)})
    `,
    db.$executeRaw`
      INSERT INTO radreply (username, attribute, op, value)
      VALUES (${username}, 'WISPr-Bandwidth-Max-Up', ':=', ${String(speedUpKbps * 1000)})
    `,
  ]);
}

export async function removeRadiusUser(username: string): Promise<void> {
  await db.$transaction([
    db.$executeRaw`DELETE FROM radcheck WHERE username = ${username}`,
    db.$executeRaw`DELETE FROM radreply WHERE username = ${username}`,
    db.$executeRaw`DELETE FROM radusergroup WHERE username = ${username}`,
  ]);
}

export async function setSimultaneousUse(
  username: string,
  limit = 1
): Promise<void> {
  await db.$executeRaw`
    INSERT INTO radcheck (username, attribute, op, value)
    VALUES (${username}, 'Simultaneous-Use', ':=', ${String(limit)})
    ON DUPLICATE KEY UPDATE value = ${String(limit)}
  `;
}

export async function updateRadiusPassword(
  username: string,
  newPassword: string,
): Promise<void> {
  await db.$executeRaw`
    UPDATE radcheck SET value = ${newPassword}
    WHERE username = ${username} AND attribute = 'Cleartext-Password'
  `;
}

export async function updateRadiusBandwidth(
  username: string,
  speedDownKbps: number,
  speedUpKbps: number,
): Promise<void> {
  const downBps = String(speedDownKbps * 1000);
  const upBps   = String(speedUpKbps   * 1000);
  await db.$transaction([
    db.$executeRaw`
      INSERT INTO radreply (username, attribute, op, value)
      VALUES (${username}, 'WISPr-Bandwidth-Max-Down', ':=', ${downBps})
      ON DUPLICATE KEY UPDATE value = ${downBps}
    `,
    db.$executeRaw`
      INSERT INTO radreply (username, attribute, op, value)
      VALUES (${username}, 'WISPr-Bandwidth-Max-Up', ':=', ${upBps})
      ON DUPLICATE KEY UPDATE value = ${upBps}
    `,
  ]);
}

/** Close open radacct session for a subscriber (server-side disconnect). */
export async function closeRadacctSession(username: string): Promise<void> {
  await db.$executeRaw`
    UPDATE radacct
    SET    AcctStopTime       = NOW(),
           AcctTerminateCause = 'Admin-Reset'
    WHERE  UserName    = ${username}
      AND  AcctStopTime IS NULL
  `;
}

/**
 * Set a total quota limit in radcheck.
 * Uses Mikrotik-Total-Limit attribute (bytes).
 */
export async function setQuotaLimit(username: string, limitMb: number): Promise<void> {
  const limitBytes = String(limitMb * 1024 * 1024);
  await db.$executeRaw`
    INSERT INTO radcheck (username, attribute, op, value)
    VALUES (${username}, 'Mikrotik-Total-Limit', ':=', ${limitBytes})
    ON DUPLICATE KEY UPDATE value = ${limitBytes}
  `;
}

/** Alias: update bandwidth profile (same as updateRadiusBandwidth). */
export async function updateUserProfile(
  username: string,
  speedDownKbps: number,
  speedUpKbps: number,
): Promise<void> {
  return updateRadiusBandwidth(username, speedDownKbps, speedUpKbps);
}

/**
 * Force-disconnect a user:
 * 1. Expire the user in radcheck (rejects future re-auth)
 * 2. Close the open radacct session
 * 3. Optionally send RADIUS PoD via radclient (best-effort, fails silently)
 */
export async function triggerDisconnect(username: string): Promise<void> {
  // 1. Find NAS IP from active session (before closing)
  type NasRow = { NASIPAddress: string; AcctSessionId: string };
  const sessions = await db.$queryRaw<NasRow[]>`
    SELECT NASIPAddress, AcctSessionId
    FROM   radacct
    WHERE  UserName = ${username} AND AcctStopTime IS NULL
    LIMIT  1
  `;

  // 2. Add past Expiration so FreeRADIUS rejects next re-auth
  await db.$executeRaw`
    INSERT INTO radcheck (username, attribute, op, value)
    VALUES (${username}, 'Expiration', ':=', '1 Jan 2000 00:00:00')
    ON DUPLICATE KEY UPDATE value = '1 Jan 2000 00:00:00'
  `;

  // 3. Close radacct session in DB
  await closeRadacctSession(username);

  // 4. Send FreeRADIUS PoD to NAS (best-effort, errors suppressed)
  if (sessions.length > 0) {
    const { NASIPAddress, AcctSessionId } = sessions[0];
    const secret  = process.env.RADIUS_SECRET ?? "testing123";
    const coaPort = process.env.RADIUS_COA_PORT ?? "3799";
    try {
      await execAsync(
        `echo "User-Name = '${username}', Acct-Session-Id = '${AcctSessionId}'" | radclient -x ${NASIPAddress}:${coaPort} disconnect ${secret}`,
        { timeout: 3000 },
      );
    } catch {
      // radclient not available in this container or PoD failed — DB expiry is the fallback
    }
  }
}
