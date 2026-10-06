import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useEffect, useSyncExternalStore } from "react";
import * as authApi from "../api/auth";
import { setUnauthenticatedHandler } from "../api/client";
import { clearSession, getToken, isAuthenticated, setSession, subscribeSession } from "./auth";

interface AuthContextValue {
	isAuthenticated: boolean;
	isAdmin: boolean;
	canWrite: boolean;
	userId: string | null;
	email: string | null;
	login: (email: string, password: string) => Promise<void>;
	logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	const queryClient = useQueryClient();
	const authed = useSyncExternalStore(subscribeSession, isAuthenticated);

	const meQuery = useQuery({
		queryKey: ["auth", "me"],
		queryFn: () => authApi.me().then((r) => r.user),
		enabled: authed,
		staleTime: Number.POSITIVE_INFINITY,
	});

	useEffect(() => {
		setUnauthenticatedHandler(() => {
			queryClient.clear();
		});
	}, [queryClient]);

	async function login(email: string, password: string) {
		const res = await authApi.login({ email, password });
		setSession(res.access_token, res.expires_at ?? Math.floor(Date.now() / 1000) + 3600);
		await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
	}

	async function logout() {
		try {
			if (getToken()) await authApi.logout();
		} finally {
			clearSession();
			queryClient.clear();
		}
	}

	const value: AuthContextValue = {
		isAuthenticated: authed,
		isAdmin: meQuery.data?.role === "admin",
		canWrite: meQuery.data?.role !== "viewer",
		userId: meQuery.data?.id ?? null,
		email: meQuery.data?.email ?? null,
		login,
		logout,
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be used within AuthProvider");
	return ctx;
}
