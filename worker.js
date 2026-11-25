const MAX_CIPHERTEXT_CHARS = 2_500_000;
const SHARE_TTL_SECONDS = 60 * 60 * 24 * 365;

function corsHeaders(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "https://melekkrkoc-coder.github.io")
        .split(",")
        .map(value => value.trim())
        .filter(Boolean);

    if (!allowed.includes(origin)) return null;

    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin"
    };
}

function json(body, status, cors) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
            ...(cors || {})
        }
    });
}

function randomId() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export default {
    async fetch(request, env) {
        const cors = corsHeaders(request, env);
        if (!cors) return new Response("Origin not allowed", { status: 403 });

        if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: cors });
        }

        if (!env.CALENDAR_SHARES) {
            return json({ error: "Storage is not configured." }, 503, cors);
        }

        const url = new URL(request.url);
        const collectionPath = "/api/shares";

        if (url.pathname === collectionPath && request.method === "POST") {
            const contentLength = Number(request.headers.get("Content-Length") || 0);
            if (contentLength > MAX_CIPHERTEXT_CHARS + 256) {
                return json({ error: "Calendar is too large." }, 413, cors);
            }

            let body;
            try {
                body = await request.json();
            } catch {
                return json({ error: "Invalid JSON." }, 400, cors);
            }

            if (
                !body ||
                typeof body.ciphertext !== "string" ||
                body.ciphertext.length < 32 ||
                body.ciphertext.length > MAX_CIPHERTEXT_CHARS ||
                !/^[A-Za-z0-9_-]+$/.test(body.ciphertext)
            ) {
                return json({ error: "Invalid encrypted calendar." }, 400, cors);
            }

            const id = randomId();
            await env.CALENDAR_SHARES.put(id, body.ciphertext, {
                expirationTtl: SHARE_TTL_SECONDS
            });

            return json({ id, expiresInDays: 365 }, 201, cors);
        }

        const match = url.pathname.match(/^\/api\/shares\/([A-Za-z0-9_-]{22})$/);
        if (match && request.method === "GET") {
            const ciphertext = await env.CALENDAR_SHARES.get(match[1]);
            if (!ciphertext) return json({ error: "Share not found or expired." }, 404, cors);
            return json({ ciphertext }, 200, cors);
        }

        return json({ error: "Not found." }, 404, cors);
    }
};
