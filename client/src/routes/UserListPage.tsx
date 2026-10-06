import { useState } from "react";
import type { Role, User } from "../api/types";
import { Button } from "../components/Button";
import { ErrorMessage } from "../components/ErrorMessage";
import { Field, FieldButtonSlot } from "../components/Field";
import { PageLoader } from "../components/Spinner";
import { useCreateUser, useUpdateUser, useUsers } from "../hooks/useUsers";
import { useAuth } from "../lib/AuthContext";
import { confirmAction } from "../lib/confirm";
import { inputClass } from "../lib/formStyles";
import { pushToast } from "../lib/toast";

const ROLE_LABELS: Record<Role, string> = {
	admin: "Administrador",
	user: "Usuario",
	viewer: "Solo lectura",
};

function UserRow({ user, canEdit, onEdit }: { user: User; canEdit: boolean; onEdit: () => void }) {
	return (
		<tr className="border-t border-gray-100 hover:bg-gray-50">
			<td className="px-4 py-2">{user.email}</td>
			<td className="px-4 py-2">{ROLE_LABELS[user.role]}</td>
			<td className="px-4 py-2 text-right">
				{canEdit && (
					<Button variant="link" onClick={onEdit}>
						Editar
					</Button>
				)}
			</td>
		</tr>
	);
}

function UserEditRow({ user, onDone }: { user: User; onDone: () => void }) {
	const updateUser = useUpdateUser();
	const [role, setRole] = useState<Role>(user.role);

	function handleSave() {
		if (
			user.role === "admin" &&
			role !== "admin" &&
			!confirmAction(`¿Quitarle el rol de administrador a ${user.email}?`)
		)
			return;
		updateUser.mutate(
			{ id: user.id, payload: { role } },
			{
				onSuccess: () => {
					pushToast("Usuario actualizado.");
					onDone();
				},
			},
		);
	}

	return (
		<tr className="border-t border-gray-100 bg-blue-50/40">
			<td className="px-4 py-2">{user.email}</td>
			<td className="px-4 py-2">
				<select
					value={role}
					onChange={(e) => setRole(e.target.value as Role)}
					className={`${inputClass} py-1`}
				>
					<option value="user">Usuario</option>
					<option value="viewer">Solo lectura</option>
					<option value="admin">Administrador</option>
				</select>
			</td>
			<td className="px-4 py-2 text-right">
				<div className="flex justify-end gap-2">
					<Button variant="secondary" onClick={onDone}>
						Cancelar
					</Button>
					<Button loading={updateUser.isPending} onClick={handleSave}>
						Guardar
					</Button>
				</div>
			</td>
		</tr>
	);
}

export function UserListPage() {
	const { isAdmin, userId } = useAuth();
	const usersQuery = useUsers();
	const createUser = useCreateUser();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [role, setRole] = useState<Role>("user");
	const [editingId, setEditingId] = useState<string | null>(null);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		createUser.mutate(
			{ email: email.trim(), password, role },
			{
				onSuccess: () => {
					setEmail("");
					setPassword("");
					setRole("user");
					pushToast("Usuario creado.");
				},
			},
		);
	}

	return (
		<div className="space-y-6">
			{isAdmin && (
				<form
					onSubmit={handleSubmit}
					className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4"
				>
					<Field label="Correo" htmlFor="email">
						<input
							id="email"
							type="email"
							required
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className={inputClass}
						/>
					</Field>
					<Field label="Contraseña" htmlFor="password" hint="Mínimo 8 caracteres">
						<input
							id="password"
							type="password"
							required
							minLength={8}
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className={inputClass}
						/>
					</Field>
					<Field label="Rol" htmlFor="role">
						<select
							id="role"
							value={role}
							onChange={(e) => setRole(e.target.value as Role)}
							className={inputClass}
						>
							<option value="user">Usuario</option>
							<option value="viewer">Solo lectura</option>
							<option value="admin">Administrador</option>
						</select>
					</Field>
					<FieldButtonSlot>
						<Button type="submit" loading={createUser.isPending}>
							Crear usuario
						</Button>
					</FieldButtonSlot>
				</form>
			)}

			<ErrorMessage error={createUser.error} />

			{usersQuery.isLoading ? (
				<PageLoader />
			) : (
				<div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
					<table className="w-full text-sm">
						<thead className="text-left text-xs text-gray-500">
							<tr>
								<th className="px-4 py-2">Correo</th>
								<th className="px-4 py-2">Rol</th>
								<th className="px-4 py-2" />
							</tr>
						</thead>
						<tbody>
							{(usersQuery.data ?? []).map((user) =>
								editingId === user.id ? (
									<UserEditRow key={user.id} user={user} onDone={() => setEditingId(null)} />
								) : (
									<UserRow
										key={user.id}
										user={user}
										canEdit={isAdmin && user.id !== userId}
										onEdit={() => setEditingId(user.id)}
									/>
								),
							)}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
