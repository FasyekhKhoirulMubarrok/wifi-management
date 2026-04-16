import { ShieldX } from "lucide-react";

export const metadata = { title: "Diblokir — FadilJaya.NET" };

export default function BlockedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
          <ShieldX className="w-10 h-10 text-red-400" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-3">Perangkat Diblokir</h1>
        <p className="text-slate-400 text-sm leading-relaxed">
          Perangkat Anda telah diblokir dari jaringan ini.
        </p>
        <p className="text-slate-500 text-sm mt-2">
          Hubungi admin jaringan jika Anda merasa ini adalah kesalahan.
        </p>

        <div className="mt-8 bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-slate-500">
            Kode kesalahan: <span className="font-mono text-slate-400">MAC_BLACKLISTED</span>
          </p>
        </div>
      </div>
    </div>
  );
}
