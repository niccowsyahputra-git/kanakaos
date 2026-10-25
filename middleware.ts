import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Route yang hanya boleh diakses SUPER_ADMIN & SOCIAL_WORKER
const STAFF_ONLY_PREFIXES = [
  "/dashboard/volunteers",
  "/dashboard/partners",
  "/dashboard/cases",
  "/dashboard/home-visits",
  "/dashboard/guardians",
];
const STAFF_ROLES = ["SUPER_ADMIN", "SOCIAL_WORKER"];
// Route yang hanya boleh diakses SUPER_ADMIN
const ADMIN_ONLY_PREFIXES = [
  "/dashboard/admin",
  "/dashboard/reports",
  "/dashboard/employees",
];
// Route keuangan: SUPER_ADMIN & FINANCE
const FINANCE_PREFIXES = ["/dashboard/finance"];
const FINANCE_ROLES = ["SUPER_ADMIN", "FINANCE"];
// Route logistik: SUPER_ADMIN & LOGISTICS
const LOGISTICS_PREFIXES = ["/dashboard/inventory", "/dashboard/assets"];
const LOGISTICS_ROLES = ["SUPER_ADMIN", "LOGISTICS"];

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    // A JWT may outlive account access; the login page must remain reachable.

    // Allow public routes to be accessed by everyone (including logged-in users)
    const publicRoutes = ["/donate", "/volunteer/apply", "/verify"];
    const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
    if (isPublicRoute) {
      return NextResponse.next();
    }

    // Proteksi role: user login tapi bukan staff -> lempar ke dashboard
    const isStaffOnlyRoute = STAFF_ONLY_PREFIXES.some((prefix) =>
      pathname.startsWith(prefix)
    );
    if (
      isStaffOnlyRoute &&
      token &&
      !STAFF_ROLES.includes(token.role as string)
    ) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // Proteksi role: route admin hanya untuk SUPER_ADMIN
    const isAdminOnlyRoute = ADMIN_ONLY_PREFIXES.some((prefix) =>
      pathname.startsWith(prefix)
    );
    if (isAdminOnlyRoute && token && token.role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // Proteksi role: route keuangan untuk SUPER_ADMIN & FINANCE
    const isFinanceRoute = FINANCE_PREFIXES.some((prefix) =>
      pathname.startsWith(prefix)
    );
    if (
      isFinanceRoute &&
      token &&
      !FINANCE_ROLES.includes(token.role as string)
    ) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // Proteksi role: route logistik untuk SUPER_ADMIN & LOGISTICS
    const isLogisticsRoute = LOGISTICS_PREFIXES.some((prefix) =>
      pathname.startsWith(prefix)
    );
    if (
      isLogisticsRoute &&
      token &&
      !LOGISTICS_ROLES.includes(token.role as string)
    ) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized({ req, token }) {
        if (req.nextUrl.pathname.startsWith("/dashboard")) {
          return token !== null;
        }
        return true;
      },
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
