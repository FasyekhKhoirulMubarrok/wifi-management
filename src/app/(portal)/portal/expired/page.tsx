import { Suspense } from "react";
import { ExpiredClient } from "@/components/portal/ExpiredClient";

export const metadata = { title: "Habis — FadilJaya.NET" };

export default function ExpiredPage() {
  return (
    <Suspense>
      <ExpiredClient />
    </Suspense>
  );
}
