export type Role = "admin" | "user" | "viewer";

export interface SessionUser {
	id: string;
	email: string;
	role: Role;
}

interface Session {
	token: string;
	expiresAt: number;
}

const STORAGE_KEY = "tenders.session";

type Listener = () => void;
const listeners = new Set<Listener>();

function read(): Session | null {
	const raw = localStorage.getItem(STORAGE_KEY);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as Session;
	} catch {
		return null;
	}
}

// UI-10: set when the server (or the token's own expiry) ends a session, shown once on the login screen.
let sessionEnded = false;

function write(session: Session | null) {
	if (session) {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
	} else {
		localStorage.removeItem(STORAGE_KEY);
	}
	for (const listener of listeners) listener();
}

export function subscribeSession(listener: Listener): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function getToken(): string | null {
	const session = read();
	if (!session) return null;
	if (session.expiresAt * 1000 <= Date.now()) {
		sessionEnded = true;
		write(null);
		return null;
	}
	return session.token;
}

export function isAuthenticated(): boolean {
	return getToken() !== null;
}

export function setSession(token: string, expiresAt: number) {
	sessionEnded = false;
	write({ token, expiresAt });
}

/** Deliberate sign-out: no "session ended" notice. */
export function clearSession() {
	sessionEnded = false;
	write(null);
}

/** The session died without the user asking (401, expired token). */
export function endSession() {
	sessionEnded = true;
	write(null);
}

export function hasSessionEnded(): boolean {
	return sessionEnded;
}
