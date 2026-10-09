import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateUserRequest, UpdateUserRequest } from "../api/types";
import * as api from "../api/users";

export function useUsers(page: number) {
	return useQuery({
		queryKey: ["users", "list", { page }],
		queryFn: () => api.listUsers(page),
		placeholderData: keepPreviousData,
	});
}

export function useCreateUser() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (payload: CreateUserRequest) => api.createUser(payload),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users", "list"] }),
	});
}

export function useUpdateUser() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, payload }: { id: string; payload: UpdateUserRequest }) => api.updateUser(id, payload),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users", "list"] }),
	});
}
