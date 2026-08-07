"use client";

// Site content moved into Settings as a tab. This route stays so existing
// bookmarks and links still land somewhere useful instead of a 404.

import * as React from "react";
import { useRouter } from "next/navigation";
import { PageLoader } from "@/components/ui/misc";

export default function AdminContentRedirect() {
  const router = useRouter();
  React.useEffect(() => {
    router.replace("/admin/settings");
  }, [router]);
  return <PageLoader label="Opening Settings…" />;
}
