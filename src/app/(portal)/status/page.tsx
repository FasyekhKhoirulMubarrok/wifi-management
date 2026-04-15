import { StatusClient } from "@/components/portal/StatusClient";

export const metadata = { title: "Status — FadilJaya.NET" };

// Proxy already enforces user_token — no need to re-check here
export default function StatusPage() {
  return <StatusClient />;
}
