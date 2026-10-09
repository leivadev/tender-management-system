import { fetchAllPages, fetchJson, pageQuery } from "./client";
import type { CreateProductRequest, Page, Product, UpdateProductRequest } from "./types";

export function listProducts(page: number) {
	return fetchJson<Page<Product>>(`/api/products?${pageQuery(page)}`);
}

export function listAllProducts() {
	return fetchAllPages<Product>("/api/products");
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
