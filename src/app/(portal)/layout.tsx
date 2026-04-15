import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "FadilJaya.NET — Portal",
  description: "Portal WiFi FadilJaya.NET",
};

export const viewport: Viewport = {
  width:        "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-950 via-slate-900 to-slate-950">
      {children}
    </div>
  );
}
