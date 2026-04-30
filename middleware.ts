import type { NextRequest } from "next/server";
import { updateAdminSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateAdminSession(request);
}

// Matches /admin and any sub-path. Static assets, the (game) routes,
// and the API are deliberately excluded — middleware should run only
// where it has a job to do.
export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
