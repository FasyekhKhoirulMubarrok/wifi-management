"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Shield, ShieldX } from "lucide-react";

interface Location { id: number; name: string }

interface MacRule {
  id:         number;
  macAddress: string;
  type:       "whitelist" | "blacklist";
  locationId: number | null;
  note:       string | null;
  createdAt:  string;
  location:   { id: number; name: string } | null;
  creator:    { id: number; name: string };
}

interface Props {
  locations: Location[];
}

const MAC_REGEX = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;

type Tab = "whitelist" | "blacklist";

export function MacRulesManager({ locations }: Props) {
  const [tab,     setTab]     = useState<Tab>("whitelist");
  const [rules,   setRules]   = useState<MacRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [delId,   setDelId]   = useState<number | null>(null);

  const fetchRules = (type: Tab) => {
    setLoading(true);
    fetch(`/api/admin/mac-rules?type=${type}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setRules(d.rules); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchRules(tab); }, [tab]);

  async function deleteRule(id: number) {
    const res = await fetch(`/api/admin/mac-rules/${id}`, { method: "DELETE" });
    if (res.ok) setRules((prev) => prev.filter((r) => r.id !== id));
    setDelId(null);
  }

  function onAdded(rule: MacRule) {
    if (rule.type === tab) setRules((prev) => [rule, ...prev]);
    setShowAdd(false);
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1 w-fit">
        {(["whitelist", "blacklist"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {t === "whitelist" ? <Shield size={14} /> : <ShieldX size={14} />}
            {t === "whitelist" ? "Whitelist" : "Blacklist"}
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} /> Tambah MAC
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-500 text-sm">Memuat...</div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          {rules.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              Belum ada {tab === "whitelist" ? "whitelist" : "blacklist"} MAC
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-xs uppercase border-b border-white/10">
                    <th className="px-4 py-3 text-left">MAC Address</th>
                    <th className="px-4 py-3 text-left">Keterangan</th>
                    <th className="px-4 py-3 text-left">Lokasi</th>
                    <th className="px-4 py-3 text-left">Tanggal</th>
                    <th className="px-4 py-3 text-left">Oleh</th>
                    <th className="px-4 py-3 text-center">Hapus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-white/5">
                      <td className="px-4 py-3 font-mono text-sm text-white">{rule.macAddress}</td>
                      <td className="px-4 py-3 text-slate-300 text-xs">{rule.note ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-300 text-xs">
                        {rule.location?.name ?? <span className="text-slate-500">Semua Lokasi</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {new Date(rule.createdAt).toLocaleDateString("id-ID")}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{rule.creator.name}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setDelId(rule.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <AddMacModal
          locations={locations}
          defaultType={tab}
          onClose={() => setShowAdd(false)}
          onAdded={onAdded}
        />
      )}

      {/* Delete confirm */}
      {delId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-white/10 rounded-xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-white mb-2">Hapus MAC Rule?</h3>
            <p className="text-sm text-slate-400 mb-4">Tindakan ini tidak bisa dibatalkan.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDelId(null)} className="text-sm text-slate-400 hover:text-white px-3 py-1.5">Batal</button>
              <button onClick={() => deleteRule(delId)} className="text-sm bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-lg">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Add Modal ────────────────────────────────────────────────────────────────

function AddMacModal({
  locations, defaultType, onClose, onAdded,
}: {
  locations:   Location[];
  defaultType: Tab;
  onClose:     () => void;
  onAdded:     (rule: MacRule) => void;
}) {
  const [mac,        setMac]        = useState("");
  const [type,       setType]       = useState<Tab>(defaultType);
  const [locationId, setLocationId] = useState("");
  const [note,       setNote]       = useState("");
  const [error,      setError]      = useState("");
  const [saving,     setSaving]     = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mac.trim()) { setError("MAC address wajib diisi"); return; }
    const normalized = mac.trim().toUpperCase();
    if (!MAC_REGEX.test(normalized)) {
      setError("Format tidak valid. Gunakan XX:XX:XX:XX:XX:XX");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/mac-rules", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          macAddress: normalized,
          type,
          locationId: locationId ? parseInt(locationId) : null,
          note:       note.trim() || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Terjadi kesalahan"); return; }
      onAdded(d.rule);
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-white/10 rounded-xl p-6 max-w-md w-full">
        <h3 className="font-semibold text-white mb-4">Tambah MAC Rule</h3>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-3 py-2 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">MAC Address <span className="text-red-400">*</span></label>
            <input
              value={mac} onChange={(e) => setMac(e.target.value)}
              placeholder="AA:BB:CC:DD:EE:FF"
              className="w-full bg-slate-700 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Tipe</label>
            <div className="flex gap-3">
              {(["whitelist", "blacklist"] as Tab[]).map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio" name="type" value={t}
                    checked={type === t} onChange={() => setType(t)}
                    className="text-blue-500"
                  />
                  <span className={`text-sm ${type === t ? "text-white" : "text-slate-400"}`}>
                    {t === "whitelist" ? "Whitelist" : "Blacklist"}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Lokasi</label>
            <select
              value={locationId} onChange={(e) => setLocationId(e.target.value)}
              className="w-full bg-slate-700 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Semua Lokasi</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Keterangan</label>
            <input
              value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Nama perangkat / pemilik"
              maxLength={255}
              className="w-full bg-slate-700 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="text-sm text-slate-400 hover:text-white px-3 py-1.5">Batal</button>
            <button
              type="submit" disabled={saving}
              className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-5 py-1.5 rounded-lg disabled:opacity-50"
            >
              {saving ? "..." : "Tambah"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
