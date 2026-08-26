export const dynamic = "force-dynamic";

export async function GET() {
  const text = (process.env.NOTICE_TEXT || "").trim();
  return Response.json({ text }, { headers: { "Cache-Control": "no-store" } });
}
