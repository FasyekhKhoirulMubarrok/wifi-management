import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateMikrotikRequest } from "@/lib/apiKeyMiddleware";
import { triggerDisconnect } from "@/lib/radius";

interface SubRow {
  id:              number;
  quota_used_mb:   bigint;
  quota_limit_mb:  bigint | null;
  expired_at:      Date | null;
  status:          string;
}

interface VoucherRow {
  id:              number;
  quota_used_mb:   bigint;
  quota_limit_mb:  bigint | null;
  expired_at:      Date | null;
  status:          string;
}

/**
 * POST /api/mikrotik/quota/update
 *
 * Body: { username: string, mb_used: number, session_id?: string }
 *
 * Uses DB transaction with FOR UPDATE row locking to prevent race conditions.
 * Handles both subscriber and voucher usernames.
 */
export async function POST(request: NextRequest) {
  const authErr = validateMikrotikRequest(request);
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: authErr.status });

  try {
    const body = await request.json() as {
      username?:   string;
      mb_used?:    number;
      session_id?: string;
    };

    const { username, mb_used } = body;

    if (!username)             return NextResponse.json({ error: "username wajib diisi" },  { status: 400 });
    if (mb_used === undefined) return NextResponse.json({ error: "mb_used wajib diisi" },   { status: 400 });
    if (typeof mb_used !== "number" || mb_used < 0) {
      return NextResponse.json({ error: "mb_used harus angka positif" }, { status: 400 });
    }

    const mbIncrement = BigInt(Math.ceil(mb_used));
    let shouldDisconnect = false;
    let isVoucher        = false;
    let entityId         = 0;

    await db.$transaction(async (tx) => {
      // ── Try subscriber first ─────────────────────────────────────────
      const subRows = await tx.$queryRaw<SubRow[]>`
        SELECT s.id, s.quota_used_mb, p.quota_limit_mb, s.expired_at, s.status
        FROM   subscribers s
        JOIN   packages    p ON p.id = s.package_id
        WHERE  s.username = ${username}
        FOR UPDATE
      `;

      if (subRows.length > 0) {
        const sub = subRows[0];
        entityId  = sub.id;

        // Increment quota
        await tx.subscriber.update({
          where: { id: sub.id },
          data:  { quotaUsedMb: { increment: mbIncrement } },
        });

        // Check if exceeded
        if (sub.quota_limit_mb !== null) {
          const newUsed = sub.quota_used_mb + mbIncrement;
          if (newUsed >= sub.quota_limit_mb) {
            await tx.subscriber.update({
              where: { id: sub.id },
              data:  { status: "expired" },
            });
            shouldDisconnect = true;
          }
        }

        // Check time expiry
        if (!shouldDisconnect && sub.expired_at && new Date() > sub.expired_at) {
          await tx.subscriber.update({
            where: { id: sub.id },
            data:  { status: "expired" },
          });
          shouldDisconnect = true;
        }

        return;
      }

      // ── Try voucher (code format XXXX-XXXX-XXXX) ─────────────────────
      const vRows = await tx.$queryRaw<VoucherRow[]>`
        SELECT v.id, v.quota_used_mb, p.quota_limit_mb, v.expired_at, v.status
        FROM   vouchers v
        JOIN   packages p ON p.id = v.package_id
        WHERE  v.code = ${username}
        FOR UPDATE
      `;

      if (vRows.length > 0) {
        const v  = vRows[0];
        entityId = v.id;
        isVoucher = true;

        await tx.voucher.update({
          where: { id: v.id },
          data:  { quotaUsedMb: { increment: mbIncrement } },
        });

        if (v.quota_limit_mb !== null) {
          const newUsed = v.quota_used_mb + mbIncrement;
          if (newUsed >= v.quota_limit_mb) {
            await tx.voucher.update({
              where: { id: v.id },
              data:  { status: "expired" },
            });
            shouldDisconnect = true;
          }
        }

        if (!shouldDisconnect && v.expired_at && new Date() > v.expired_at) {
          await tx.voucher.update({
            where: { id: v.id },
            data:  { status: "expired" },
          });
          shouldDisconnect = true;
        }

        // Invalidate portal sessions for this voucher
        if (shouldDisconnect) {
          await tx.session.updateMany({
            where: { userId: `voucher:${v.id}`, userType: "voucher", isActive: true },
            data:  { isActive: false },
          });
        }
      }
      // If not found in either table, silently ignore (could be trial user)
    });

    // Outside transaction: trigger disconnect if quota exceeded
    if (shouldDisconnect) {
      // Invalidate subscriber portal sessions
      if (!isVoucher) {
        await db.session.updateMany({
          where: { userId: String(entityId), userType: "subscriber", isActive: true },
          data:  { isActive: false },
        });
      }
      // Trigger FreeRADIUS disconnect
      await triggerDisconnect(username);
    }

    return NextResponse.json({
      ok:               true,
      disconnected:     shouldDisconnect,
      entity:           isVoucher ? "voucher" : "subscriber",
    });
  } catch (err) {
    console.error("[mikrotik/quota/update]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
