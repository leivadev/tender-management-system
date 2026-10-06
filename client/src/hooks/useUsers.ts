import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateUserRequest, UpdateUserRequest } from "../api/types";
import * as api from "../api/users";

export function useUsers() {
	return useQuery({
		queryKey: ["users", "list"],
		queryFn: () => api.listUsers().then((r) => r.users),
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
