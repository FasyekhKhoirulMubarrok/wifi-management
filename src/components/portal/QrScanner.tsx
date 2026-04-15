"use client";

import { useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";

interface Props {
  onResult: (code: string) => void;
  onClose:  () => void;
}

export function QrScanner({ onResult, onClose }: Props) {
  const scannerRef   = useRef<unknown>(null);
  const hasResult    = useRef(false);
  const handleResult = useCallback(onResult, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let mounted = true;

    async function start() {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (!mounted) return;

      const scanner = new Html5Qrcode("portal-qr-reader");
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded: string) => {
            if (hasResult.current) return;
            hasResult.current = true;
            handleResult(decoded);
            scanner.stop().catch(() => {/* ignore */});
          },
          undefined,
        );
      } catch {
        // Camera permission denied or not available
        const el = document.getElementById("portal-qr-reader");
        if (el) el.innerHTML = '<p class="text-red-400 text-sm text-center p-4">Tidak bisa mengakses kamera. Pastikan izin kamera diberikan.</p>';
      }
    }

    start();

    return () => {
      mounted = false;
      if (scannerRef.current) {
        const s = scannerRef.current as { stop: () => Promise<void>; clear: () => void };
        s.stop().then(() => s.clear()).catch(() => {/* ignore */});
      }
    };
  }, [handleResult]);

  return (
    <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden w-full max-w-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <p className="text-sm font-medium text-white">Scan QR Voucher</p>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div id="portal-qr-reader" className="w-full" />
        <p className="text-xs text-slate-500 text-center py-3">
          Arahkan kamera ke QR code voucher
        </p>
      </div>
    </div>
  );
}
