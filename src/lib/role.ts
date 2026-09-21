import { useEffect, useState } from "react";

// Role gate for the dashboard UI, backed by a plain `role` cookie.
//
// NOTE: this decides what the UI *offers*, not what the server allows. The
// cookie is readable and writable by anyone with devtools, so it is a
// convenience gate, not access control.

export const ROLE_COOKIE = "role";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Read a cookie by exact name, or null when it is not set. */
export function readCookie(name: string): string | null {
    if (typeof document === "undefined") return null;

    for (const part of document.cookie.split(";")) {
        const separator = part.indexOf("=");
        if (separator === -1) continue;
        if (part.slice(0, separator).trim() !== name) continue;
        return decodeURIComponent(part.slice(separator + 1).trim());
    }

    return null;
}

/**
 * Current role, defaulting a visitor who has no cookie yet to "user".
 *
 * An existing cookie is returned untouched — an admin keeps their role and
 * never gets overwritten with "user".
 */
export function ensureRole(): string | null {
    if (typeof document === "undefined") return null;

    const current = readCookie(ROLE_COOKIE);
    if (current) return current;

    document.cookie = `${ROLE_COOKIE}=user; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
    return "user";
}

export function isAdmin(role: string | null): boolean {
    return typeof role === "string" && role.trim().toLowerCase() === "admin";
}

/**
 * Role of the current visitor, or null until the first client render (the
 * cookie is not readable while server-rendering).
 */
export function useRole(): string | null {
    const [role, setRole] = useState<string | null>(null);

    useEffect(() => {
        setRole(ensureRole());
    }, []);

    return role;
}
