export type Role = "admin" | "user";

export interface SessionUser {
	id: string;
	email: string;
	role: Role;
}

interface Session {
	token: string;
	expiresAt: number;
}

const STORAGE_KEY = "licitaciones.session";

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
		write(null);
		return null;
	}
	return session.token;
}

export function isAuthenticated(): boolean {
	return getToken() !== null;
}

export function setSession(token: string, expiresAt: number) {
	write({ token, expiresAt });
}

export function clearSession() {
	write(null);
}
