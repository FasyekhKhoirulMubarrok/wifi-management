"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Image as ImageIcon } from "lucide-react";

interface Ad {
  id:          number;
  title:       string;
  description: string | null;
  imageUrl:    string | null;
  linkUrl:     string | null;
  locationId:  number | null;
  priority:    number;
  isActive:    boolean;
  startDate:   string | null;
  endDate:     string | null;
  impressions: number;
  clicks:      number;
  ctr:         number;
  location:    { id: number; name: string } | null;
}

export function AdvertisementsManager() {
  const router = useRouter();
  const [ads,     setAds]     = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [delId,   setDelId]   = useState<number | null>(null);

  const fetchAds = () => {
    setLoading(true);
    fetch("/api/admin/advertisements")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setAds(d.ads); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAds(); }, []);

  async function toggleAd(id: number) {
    await fetch(`/api/admin/advertisements/${id}/toggle`, { method: "PATCH" });
    setAds((prev) => prev.map((a) => a.id === id ? { ...a, isActive: !a.isActive } : a));
  }

  async function deleteAd(id: number) {
    const res = await fetch(`/api/admin/advertisements/${id}`, { method: "DELETE" });
    if (res.ok) {
      setAds((prev) => prev.filter((a) => a.id !== id));
    }
    setDelId(null);
  }

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("id-ID") : "—";

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => router.push("/admin/advertisements/new")}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} /> Tambah Iklan
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-500 text-sm">Memuat...</div>
      ) : ads.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <ImageIcon size={40} className="mx-auto mb-3 opacity-30" />
          <p>Belum ada iklan</p>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-xs uppercase border-b border-white/10">
                  <th className="px-4 py-3 text-left">Iklan</th>
                  <th className="px-4 py-3 text-left">Lokasi</th>
                  <th className="px-4 py-3 text-center">Prioritas</th>
                  <th className="px-4 py-3 text-center">Jadwal</th>
                  <th className="px-4 py-3 text-center">Impresi</th>
                  <th className="px-4 py-3 text-center">Klik</th>
                  <th className="px-4 py-3 text-center">CTR</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {ads.map((ad) => (
                  <tr key={ad.id} className="hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {ad.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={ad.imageUrl} alt={ad.title}
                            className="w-12 h-8 object-cover rounded border border-white/10 bg-slate-700"
                          />
                        ) : (
                          <div className="w-12 h-8 bg-slate-700 rounded border border-white/10 flex items-center justify-center">
                            <ImageIcon size={12} className="text-slate-500" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-white">{ad.title}</p>
                          {ad.description && <p className="text-xs text-slate-400 truncate max-w-[200px]">{ad.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs">
                      {ad.location?.name ?? <span className="text-slate-500">Semua Lokasi</span>}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-300">{ad.priority}</td>
                    <td className="px-4 py-3 text-center text-xs text-slate-400">
                      {ad.startDate || ad.endDate
                        ? `${fmtDate(ad.startDate)} – ${fmtDate(ad.endDate)}`
                        : <span className="text-slate-500">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-center text-slate-300">{ad.impressions.toLocaleString("id-ID")}</td>
                    <td className="px-4 py-3 text-center text-slate-300">{ad.clicks.toLocaleString("id-ID")}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-medium ${ad.ctr >= 5 ? "text-emerald-400" : ad.ctr >= 2 ? "text-amber-400" : "text-slate-400"}`}>
                        {ad.ctr}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleAd(ad.id)}
                        className={ad.isActive ? "text-emerald-400 hover:text-emerald-300" : "text-slate-500 hover:text-slate-400"}
                        title={ad.isActive ? "Nonaktifkan" : "Aktifkan"}
                      >
                        {ad.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => router.push(`/admin/advertisements/${ad.id}`)}
                          className="text-blue-400 hover:text-blue-300"
                          title="Edit"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => setDelId(ad.id)}
                          className="text-red-400 hover:text-red-300"
                          title="Hapus"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {delId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-white/10 rounded-xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-white mb-2">Hapus Iklan?</h3>
            <p className="text-sm text-slate-400 mb-4">Tindakan ini tidak bisa dibatalkan.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDelId(null)} className="text-sm text-slate-400 hover:text-white px-3 py-1.5">Batal</button>
              <button onClick={() => deleteAd(delId)} className="text-sm bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-lg">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
