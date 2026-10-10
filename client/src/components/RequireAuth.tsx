import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { ForbiddenPage } from "../routes/ForbiddenPage";
import { PageLoader } from "./Spinner";

export function RequireAuth({ children }: { children: ReactNode }) {
	const { isAuthenticated } = useAuth();
	const location = useLocation();

	if (!isAuthenticated) {
		return <Navigate to="/login" replace state={{ from: location.pathname }} />;
	}

	return <>{children}</>;
}

/** Renders the 403 page for non-admins. Waits for the profile so admins never see a flash of it. */
export function RequireAdmin({ children }: { children: ReactNode }) {
	const { isAdmin, isLoading } = useAuth();
	if (isLoading) return <PageLoader />;
	if (!isAdmin) return <ForbiddenPage />;
	return <>{children}</>;
}
