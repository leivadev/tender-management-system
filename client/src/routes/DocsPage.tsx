import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { fetchJson } from "../api/client";
import { ErrorMessage } from "../components/ErrorMessage";
import { PageHeader } from "../components/PageHeader";
import { PageLoader } from "../components/Spinner";
import { getToken } from "../lib/auth";

/** FR-32: Swagger UI for any signed-in role; the spec and "Try it out" requests carry the session token. */
export function DocsPage() {
	const container = useRef<HTMLDivElement>(null);
	const spec = useQuery({
		queryKey: ["openapi"],
		queryFn: () => fetchJson<object>("/openapi.json"),
		staleTime: Number.POSITIVE_INFINITY,
	});

	useEffect(() => {
		const domNode = container.current;
		if (!spec.data || !domNode) return;
		let cancelled = false;
		(async () => {
			const [{ default: SwaggerUI }] = await Promise.all([
				import("swagger-ui-dist/swagger-ui-es-bundle.js"),
				import("swagger-ui-dist/swagger-ui.css"),
			]);
			if (cancelled) return;
			SwaggerUI({
				domNode,
				spec: spec.data,
				requestInterceptor: (req) => {
					// Never send the session token to another origin.
					if (new URL(req.url, window.location.origin).origin !== window.location.origin) return req;
					const token = getToken();
					if (token) req.headers.Authorization = `Bearer ${token}`;
					return req;
				},
			});
		})();
		return () => {
			cancelled = true;
			domNode.replaceChildren();
		};
	}, [spec.data]);

	return (
		<>
			<PageHeader title="API documentation" description="Try it out requests use your current session." />
			{spec.isPending && <PageLoader label="Loading API documentation…" />}
			<ErrorMessage error={spec.error} />
			<div ref={container} className="rounded-card border border-border bg-card p-2" />
		</>
	);
}
