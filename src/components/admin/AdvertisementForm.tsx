"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Image as ImageIcon, Upload, ExternalLink } from "lucide-react";

interface Location { id: number; name: string }

interface AdInitial {
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
}

interface Props {
  initial?:   AdInitial;
  locations:  Location[];
}

export function AdvertisementForm({ initial, locations }: Props) {
  const router  = useRouter();
  const isNew   = !initial;
  const fileRef = useRef<HTMLInputElement>(null);

  const [title,        setTitle]       = useState(initial?.title       ?? "");
  const [description,  setDescription] = useState(initial?.description ?? "");
  const [linkUrl,      setLinkUrl]     = useState(initial?.linkUrl      ?? "");
  const [locationId,   setLocationId]  = useState<string>(initial?.locationId?.toString() ?? "");
  const [priority,     setPriority]    = useState(initial?.priority     ?? 0);
  const [startDate,    setStartDate]   = useState(initial?.startDate ? initial.startDate.slice(0, 10) : "");
  const [endDate,      setEndDate]     = useState(initial?.endDate   ? initial.endDate.slice(0, 10)   : "");
  const [imagePreview, setImagePreview] = useState<string | null>(initial?.imageUrl ?? null);
  const [imageFile,    setImageFile]    = useState<File | null>(null);

  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
      setError("Hanya JPG dan PNG yang diperbolehkan");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Ukuran gambar maksimal 2MB");
      return;
    }
    setImageFile(file);
    setError("");
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Judul wajib diisi"); return; }
    if (description.length > 100) { setError("Deskripsi maksimal 100 karakter"); return; }

    setSaving(true);
    setError("");

    const fd = new FormData();
    fd.append("title",       title.trim());
    fd.append("description", description);
    fd.append("linkUrl",     linkUrl);
    fd.append("locationId",  locationId);
    fd.append("priority",    String(priority));
    fd.append("startDate",   startDate);
    fd.append("endDate",     endDate);
    if (imageFile) fd.append("image", imageFile);

    try {
      const url    = isNew ? "/api/admin/advertisements" : `/api/admin/advertisements/${initial!.id}`;
      const method = isNew ? "POST" : "PUT";
      const res    = await fetch(url, { method, body: fd });
      const d      = await res.json();
      if (!res.ok) { setError(d.error ?? "Terjadi kesalahan"); return; }
      router.push("/admin/advertisements");
      router.refresh();
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-sm text-slate-300 mb-1.5">Judul <span className="text-red-400">*</span></label>
          <input
            value={title} onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm text-slate-300 mb-1.5">
            Deskripsi
            <span className="text-slate-500 text-xs ml-2">({description.length}/100)</span>
          </label>
          <textarea
            value={description} onChange={(e) => setDescription(e.target.value)}
            maxLength={100} rows={2}
            className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Link URL */}
        <div>
          <label className="block text-sm text-slate-300 mb-1.5">Link Tujuan</label>
          <input
            type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://..."
            className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Image upload */}
        <div>
          <label className="block text-sm text-slate-300 mb-1.5">Gambar (JPG/PNG, maks 2MB)</label>
          <input
            type="file" ref={fileRef} accept="image/jpeg,image/jpg,image/png"
            onChange={handleFileChange} className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 text-sm bg-slate-700 hover:bg-slate-600 border border-white/10 text-slate-300 px-4 py-2 rounded-lg transition-colors"
          >
            <Upload size={14} /> {imageFile ? imageFile.name : "Pilih Gambar"}
          </button>
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm text-slate-300 mb-1.5">Lokasi</label>
          <select
            value={locationId} onChange={(e) => setLocationId(e.target.value)}
            className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Semua Lokasi</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        {/* Priority */}
        <div>
          <label className="block text-sm text-slate-300 mb-1.5">
            Prioritas <span className="text-slate-500 text-xs">(lebih kecil = lebih prioritas)</span>
          </label>
          <input
            type="number" min={0} max={999}
            value={priority} onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
            className="w-32 bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Tanggal Mulai</label>
            <input
              type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Tanggal Selesai</label>
            <input
              type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit" disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-6 py-2 rounded-lg disabled:opacity-50 transition-colors"
          >
            {saving ? "Menyimpan..." : isNew ? "Tambah Iklan" : "Simpan Perubahan"}
          </button>
          <button
            type="button" onClick={() => router.back()}
            className="text-slate-400 hover:text-white text-sm px-4 py-2"
          >
            Batal
          </button>
        </div>
      </form>

      {/* Preview */}
      <div>
        <p className="text-sm text-slate-400 mb-3">Preview Iklan</p>
        <div className="bg-white rounded-xl overflow-hidden shadow-lg max-w-sm">
          {imagePreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imagePreview} alt="preview" className="w-full h-40 object-cover" />
          ) : (
            <div className="w-full h-40 bg-slate-200 flex items-center justify-center">
              <ImageIcon size={32} className="text-slate-400" />
            </div>
          )}
          <div className="p-4">
            <h3 className="font-bold text-slate-900 text-base">
              {title || <span className="text-slate-400">Judul Iklan</span>}
            </h3>
            {description && <p className="text-slate-600 text-sm mt-1">{description}</p>}
            {linkUrl && (
              <a href="#" className="inline-flex items-center gap-1 text-blue-600 text-sm mt-2 hover:underline">
                Selengkapnya <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
