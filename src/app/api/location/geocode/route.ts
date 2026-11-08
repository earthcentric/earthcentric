import { geocodeAddress, reverseGeocode } from "@/lib/location-services";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json({ error: "Request body is invalid." }, { status: 400 });
  }

  try {
    const data = body as Record<string, unknown>;
    const result = data.mode === "reverse"
      ? await reverseGeocode(Number(data.latitude), Number(data.longitude))
      : typeof data.query === "string"
        ? await geocodeAddress(data.query)
        : null;
    if (!result) {
      return Response.json({ error: "No matching address was found. You can continue with manual entry." }, { status: 404 });
    }
    return Response.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Location lookup failed:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Location lookup is temporarily unavailable." },
      { status: 502 }
    );
  }
}
