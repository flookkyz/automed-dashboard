import { handlers } from "./handlers";

// Client-side mock API. When enabled, `window.fetch` is wrapped so requests to
// `/api/<route>` are answered from `./handlers` instead of the server; every
// existing `fetch(...)` call in the app stays exactly as it is.
//
// Enable with NEXT_PUBLIC_USE_MOCK=true (e.g. in .env.local) and restart
// `npm run dev`. Routes without a mock handler still go to the real server.

export const MOCK_ENABLED = process.env.NEXT_PUBLIC_USE_MOCK === "true";

/** Simulated network latency, so loading states are still visible. */
const LATENCY_MS = 250;

function requestUrl(input: RequestInfo | URL): URL {
    if (input instanceof URL) return input;
    if (typeof input === "string") return new URL(input, window.location.origin);
    return new URL(input.url);
}

async function requestBody(input: RequestInfo | URL, init?: RequestInit): Promise<any> {
    const raw = init?.body ?? (input instanceof Request ? await input.clone().text() : undefined);
    if (typeof raw !== "string" || !raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export function installMockFetch(): void {
    if (!MOCK_ENABLED || typeof window === "undefined") return;
    if ((window as any).__automed_mock_installed) return;
    (window as any).__automed_mock_installed = true;

    const realFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = requestUrl(input);
        const match = url.origin === window.location.origin && url.pathname.match(/^\/api\/([^/]+)\/?$/);
        const handler = match ? handlers[match[1]] : undefined;
        if (!handler) return realFetch(input, init);

        const body = await requestBody(input, init);
        const result = handler(url.searchParams, body);
        await new Promise((r) => setTimeout(r, LATENCY_MS));

        return new Response(JSON.stringify(result.body), {
            status: result.status,
            headers: { "Content-Type": "application/json" },
        });
    };

    console.info("[mock] /api/* responses are served from src/mocks");
}
