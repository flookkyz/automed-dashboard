import type { NextApiRequest } from "next";

// Name rules and request parsing shared by the add/delete product routes.
// Framework-agnostic on purpose (no React), so both the API routes and the
// client pages can use the same helpers.

// A subProduct name doubles as a MongoDB collection name and as a URL segment
// (`/{mainproduct}/{subproduct}`), so new names are kept to safe characters.
export const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

const RESERVED_NAMES = new Set(["product_name"]);

export type NameResult = { value?: string; error?: string };

function reserved(value: string): boolean {
    const lower = value.toLowerCase();
    return RESERVED_NAMES.has(lower) || lower.startsWith("system.");
}

/** Validate a name that is about to be created. */
export function validateNewName(raw: unknown, label: string): NameResult {
    if (typeof raw !== "string") return { error: `${label} must be a string` };

    const value = raw.trim();
    if (!value) return { error: `${label} is required` };
    if (!NAME_PATTERN.test(value)) {
        return {
            error: `${label} "${value}" is invalid: use 1-64 characters, letters/digits/._- only, starting with a letter or digit`,
        };
    }
    if (reserved(value)) return { error: `${label} "${value}" is reserved` };

    return { value };
}

/**
 * Validate a name that is only matched against what is already stored. Lenient
 * on purpose: it rejects what is unusable as a collection name rather than
 * enforcing the stricter pattern new names are created with, so an older name
 * can still be removed.
 */
export function validateExistingName(raw: unknown, label: string): NameResult {
    if (typeof raw !== "string") return { error: `${label} must be a string` };

    const value = raw.trim();
    if (!value) return { error: `${label} is required` };
    if (value.includes("\0") || value.includes("$")) {
        return { error: `${label} "${value}" is invalid` };
    }
    if (reserved(value)) return { error: `${label} "${value}" is reserved` };

    return { value };
}

export function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A name from `list` that matches `value` apart from letter case. */
export function findSimilar(value: string, list: string[]): string | undefined {
    const lower = value.toLowerCase();
    return list.find((name) => name !== value && name.toLowerCase() === lower);
}

/**
 * Body of a JSON request. Next parses it already, but a caller that sends no
 * content-type leaves a raw string behind, so handle both.
 */
export function parseJsonBody(req: NextApiRequest): Record<string, any> | null {
    const body = req.body;

    if (typeof body === "string") {
        if (!body) return null;
        try {
            const parsed = JSON.parse(body);
            return parsed && typeof parsed === "object" ? parsed : null;
        } catch {
            return null;
        }
    }

    return body && typeof body === "object" ? body : null;
}
