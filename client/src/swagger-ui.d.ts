declare module "swagger-ui-dist/swagger-ui-es-bundle.js" {
	interface SwaggerUIRequest {
		url: string;
		headers: Record<string, string>;
	}

	interface SwaggerUIOptions {
		domNode: HTMLElement;
		spec: object;
		requestInterceptor?: (req: SwaggerUIRequest) => SwaggerUIRequest;
	}

	export default function SwaggerUI(options: SwaggerUIOptions): unknown;
}

declare module "swagger-ui-dist/swagger-ui.css";
