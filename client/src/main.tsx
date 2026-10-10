import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ApiError, mapErrorToMessage } from "./api/errors";
import { AuthProvider } from "./lib/AuthContext";
import { pushToast } from "./lib/toast";
import "./styles/index.css";

const queryClient = new QueryClient({
	mutationCache: new MutationCache({
		onError: (error) => {
			// 401 already clears the session and redirects to login.
			if (error instanceof ApiError && error.status === 401) return;
			pushToast(
				error instanceof ApiError ? mapErrorToMessage(error) : "An unexpected error occurred.",
				"error",
			);
		},
	}),
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: true,
			staleTime: 30_000,
		},
	},
});

// biome-ignore lint/style/noNonNullAssertion: index.html always has #root
createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<AuthProvider>
				<App />
			</AuthProvider>
		</QueryClientProvider>
	</StrictMode>,
);
