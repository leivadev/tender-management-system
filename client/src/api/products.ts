import { fetchJson } from "./client";
import type { CreateProductRequest, Product, UpdateProductRequest } from "./types";

export function listProducts() {
	return fetchJson<{ success: true; products: Product[] }>("/api/products");
}

export function createProduct(payload: CreateProductRequest) {
	return fetchJson<{ success: true; product: Product }>("/api/products", {
		method: "POST",
		body: JSON.stringify(payload),
	});
}

export function updateProduct(id: string, payload: UpdateProductRequest) {
	return fetchJson<{ success: true; product: Product }>(`/api/products/${id}`, {
		method: "PATCH",
		body: JSON.stringify(payload),
	});
}
