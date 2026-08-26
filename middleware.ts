import { NextRequest, NextResponse } from "next/server";

const OLD_HOST = "kbonhopftimt.sealosbja.site";
const NEW_URL = "https://outgate.chat";

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  if (host.includes(OLD_HOST)) {
    // 历史后台保留在老域名可访问（Sealos 侧数据）
    if (req.nextUrl.pathname.startsWith("/admin")) {
      return NextResponse.next();
    }
    const url = new URL(req.nextUrl.pathname + req.nextUrl.search, NEW_URL);
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
