import { Plus } from "lucide-react";
import { useState } from "react";
import type { Role, User } from "../api/types";
import { Badge, type Tone } from "../components/Badge";
import { Button } from "../components/Button";
import { Card, CardHeader } from "../components/Card";
import { ErrorMessage } from "../components/ErrorMessage";
import { Field, FieldButtonSlot } from "../components/Field";
import { PageHeader } from "../components/PageHeader";
import { Pagination } from "../components/Pagination";
import { TableSkeleton } from "../components/Skeleton";
import { Table, TBody, TD, TH, THead, TR } from "../components/Table";
import { useListParams } from "../hooks/useListParams";
import { useCreateUser, useUpdateUser, useUsers } from "../hooks/useUsers";
import { useAuth } from "../lib/AuthContext";
import { confirmAction } from "../lib/confirm";
import { inputClass } from "../lib/formStyles";
import { pushToast } from "../lib/toast";

const ROLE_LABELS: Record<Role, string> = {
	admin: "Administrator",
	user: "User",
	viewer: "Read-only",
};

const ROLE_TONES: Record<Role, Tone> = {
	admin: "accent",
	user: "info",
	viewer: "neutral",
};

function UserRow({
	user,
	isYou,
	canEdit,
	onEdit,
}: {
	user: User;
	isYou: boolean;
	canEdit: boolean;
	onEdit: () => void;
}) {
	return (
		<TR>
			<TD className="font-medium">
				{user.email}
				{isYou && <span className="ml-2 text-xs font-normal text-muted-foreground">(you)</span>}
			</TD>
			<TD>
				<Badge tone={ROLE_TONES[user.role]}>{ROLE_LABELS[user.role]}</Badge>
			</TD>
			<TD className="text-right">
				{canEdit && (
					<Button variant="ghost" onClick={onEdit}>
						Edit
					</Button>
				)}
			</TD>
		</TR>
	);
}

function UserEditRow({ user, onDone }: { user: User; onDone: () => void }) {
	const updateUser = useUpdateUser();
	const [role, setRole] = useState<Role>(user.role);

	async function handleSave() {
		if (
			user.role === "admin" &&
			role !== "admin" &&
			!(await confirmAction({
				title: `Remove the administrator role from ${user.email}?`,
				description: "They will lose access to user management.",
				confirmLabel: "Remove role",
				destructive: true,
			}))
		)
			return;
		updateUser.mutate(
			{ id: user.id, payload: { role } },
			{
				onSuccess: () => {
					pushToast("User updated.");
					onDone();
				},
			},
		);
	}

	return (
		<TR className="h-14 bg-primary-soft/40">
			<TD className="font-medium">{user.email}</TD>
			<TD>
				<select
					aria-label="Role"
					value={role}
					onChange={(e) => setRole(e.target.value as Role)}
					className={`${inputClass} w-44`}
				>
					<option value="user">User</option>
					<option value="viewer">Read-only</option>
					<option value="admin">Administrator</option>
				</select>
			</TD>
			<TD>
				<div className="flex justify-end gap-2">
					<Button variant="secondary" onClick={onDone}>
						Cancel
					</Button>
					<Button loading={updateUser.isPending} onClick={handleSave}>
						Save
					</Button>
				</div>
			</TD>
		</TR>
	);
}

function CreateUserForm({ onDone }: { onDone: () => void }) {
	const createUser = useCreateUser();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [role, setRole] = useState<Role>("user");

	function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
		e.preventDefault();
		createUser.mutate(
			{ email: email.trim(), password, role },
			{
				onSuccess: () => {
					pushToast("User created.");
					onDone();
				},
			},
		);
	}

	return (
		<Card className="mb-4">
			<CardHeader title="New user" />
			<form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 p-4">
				<Field label="Email" htmlFor="email">
					<input
						id="email"
						type="email"
						required
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						className={inputClass}
					/>
				</Field>
				<Field label="Password" htmlFor="password" hint="Minimum 8 characters">
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
				<Field label="Role" htmlFor="role">
					<select
						id="role"
						value={role}
						onChange={(e) => setRole(e.target.value as Role)}
						className={inputClass}
					>
						<option value="user">User</option>
						<option value="viewer">Read-only</option>
						<option value="admin">Administrator</option>
					</select>
				</Field>
				<FieldButtonSlot>
					<div className="flex gap-2">
						<Button variant="secondary" onClick={onDone}>
							Cancel
						</Button>
						<Button type="submit" loading={createUser.isPending}>
							Create user
						</Button>
					</div>
				</FieldButtonSlot>
			</form>
		</Card>
	);
}

export function UserListPage() {
	const { isAdmin, userId } = useAuth();
	const { page, setPage } = useListParams();
	const usersQuery = useUsers(page);
	const [creating, setCreating] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);

	return (
		<>
			<PageHeader
				title="Users"
				description="Who can sign in and what they can do."
				actions={
					!creating && (
						<Button onClick={() => setCreating(true)}>
							<Plus className="size-3.5" aria-hidden="true" /> New user
						</Button>
					)
				}
			/>

			{creating && <CreateUserForm onDone={() => setCreating(false)} />}

			<div className="space-y-4">
				{usersQuery.error && <ErrorMessage error={usersQuery.error} />}

				{usersQuery.isLoading ? (
					<TableSkeleton rows={5} cols={3} />
				) : (
					<Table>
						<THead>
							<tr>
								<TH>Email</TH>
								<TH>Role</TH>
								<TH className="w-1">
									<span className="sr-only">Actions</span>
								</TH>
							</tr>
						</THead>
						<TBody>
							{(usersQuery.data?.data ?? []).map((user) =>
								editingId === user.id ? (
									<UserEditRow key={user.id} user={user} onDone={() => setEditingId(null)} />
								) : (
									<UserRow
										key={user.id}
										user={user}
										isYou={user.id === userId}
										canEdit={isAdmin && user.id !== userId}
										onEdit={() => setEditingId(user.id)}
									/>
								),
							)}
						</TBody>
					</Table>
				)}

				{usersQuery.data && <Pagination meta={usersQuery.data} onChange={setPage} />}
			</div>
		</>
	);
}
