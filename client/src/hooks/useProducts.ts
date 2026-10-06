import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/products";
import type { CreateProductRequest, UpdateProductRequest } from "../api/types";

export function useProducts() {
	return useQuery({
		queryKey: ["products", "list"],
		queryFn: () => api.listProducts().then((r) => r.products),
	});
}

export function useCreateProduct() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (payload: CreateProductRequest) => api.createProduct(payload),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products", "list"] }),
	});
}

export function useUpdateProduct() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, payload }: { id: string; payload: UpdateProductRequest }) =>
			api.updateProduct(id, payload),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products", "list"] }),
	});
}
