import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function RootPage() {
  const headersList = await headers();
  const host = headersList.get("host") ?? "";

  if (host.startsWith("wifi.")) {
    redirect("/portal/login");
  }

  redirect("/admin/login");
}
