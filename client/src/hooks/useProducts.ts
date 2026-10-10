import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/products";
import type { CreateProductRequest, UpdateProductRequest } from "../api/types";

export function useProducts(page: number, q?: string) {
	return useQuery({
		queryKey: ["products", "list", { page, q }],
		queryFn: () => api.listProducts(page, q),
		placeholderData: keepPreviousData,
	});
}

export function useAllProducts() {
	return useQuery({
		queryKey: ["products", "all"],
		queryFn: () => api.listAllProducts(),
	});
}

export function useCreateProduct() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (payload: CreateProductRequest) => api.createProduct(payload),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
	});
}

export function useUpdateProduct() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, payload }: { id: string; payload: UpdateProductRequest }) =>
			api.updateProduct(id, payload),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
	});
}
