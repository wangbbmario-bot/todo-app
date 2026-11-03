import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge-compatible middleware（不导入 NextAuth，避免 bcrypt 等 Node-only API）
 *
 * 通过读取 NextAuth 的 session token cookie 来判断登录态。
 * 实际鉴权仍由 NextAuth 在 /api/auth/* 路由和 Server Component 中完成。
 *
 * 测试/E2E 时可通过设置 `auth-bypass=1` cookie 或本地存储来跳过拦截。
 */
const SESSION_COOKIES = [
  "authjs.session-token",      // dev
  "__Secure-authjs.session-token", // prod
];

function isLoggedIn(req: NextRequest): boolean {
  for (const name of SESSION_COOKIES) {
    if (req.cookies.get(name)?.value) return true;
  }
  return false;
}

const PUBLIC_PATHS = [
  // 2026-11-03：ICP 备案审核要求「审核时能直接看到网站内容」，
  //   所以首页要公开（未登录看到的是产品落地页，不是登录框）。
  //   数据仍然受保护：所有业务接口都要 session。
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/api/auth",
  "/api/register",
  // 2026-10-26：构建版本文件（header 显示版本号用），必须免登录访问
  "/version.json",
];

function isPublic(pathname: string): boolean {
  return (
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.json" ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/uploads")
  );
}

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // 测试/E2E bypass：cookie 或 header 携带 `auth-bypass=1` 时跳过
  const bypass =
    req.cookies.get("auth-bypass")?.value === "1" ||
    req.headers.get("x-auth-bypass") === "1";
  if (bypass) return NextResponse.next();

  const loggedIn = isLoggedIn(req);

  if (isPublic(pathname)) {
    if (loggedIn && (pathname === "/login" || pathname === "/register")) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (!loggedIn) {
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|uploads/).*)"],
};