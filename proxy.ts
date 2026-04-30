import type { NextRequest } from "next/server";
import { updateAdminSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateAdminSession(request);
}

// Matches /admin and any sub-path. Static assets, the (game) routes,
// and the API are deliberately excluded — proxy should run only
// where it has a job to do.
export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
