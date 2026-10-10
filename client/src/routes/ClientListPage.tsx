import { Plus, SearchX, Users } from "lucide-react";
import { useState } from "react";
import type { Client } from "../api/types";
import { Button } from "../components/Button";
import { Card, CardHeader } from "../components/Card";
import { DisabledAction } from "../components/DisabledAction";
import { EmptyState } from "../components/EmptyState";
import { ErrorMessage } from "../components/ErrorMessage";
import { Field, FieldButtonSlot } from "../components/Field";
import { PageHeader } from "../components/PageHeader";
import { Pagination } from "../components/Pagination";
import { SearchInput } from "../components/SearchInput";
import { TableSkeleton } from "../components/Skeleton";
import { Table, TBody, TD, TH, THead, TR } from "../components/Table";
import { useClients, useCreateClient, useUpdateClient } from "../hooks/useClients";
import { useListParams } from "../hooks/useListParams";
import { useAuth } from "../lib/AuthContext";
import { inputClass } from "../lib/formStyles";
import { pushToast } from "../lib/toast";

function ClientRow({ client, onEdit }: { client: Client; onEdit: () => void }) {
	const { canWrite } = useAuth();
	return (
		<TR>
			<TD className="font-medium">{client.name}</TD>
			<TD>{client.companyName}</TD>
			<TD className="text-muted-foreground">{client.email}</TD>
			<TD className="text-right">
				{canWrite && (
					<Button variant="ghost" onClick={onEdit}>
						Edit
					</Button>
				)}
			</TD>
		</TR>
	);
}

function ClientEditRow({ client, onDone }: { client: Client; onDone: () => void }) {
	const updateClient = useUpdateClient();
	const [name, setName] = useState(client.name);
	const [companyName, setCompanyName] = useState(client.companyName);
	const [email, setEmail] = useState(client.email);

	function handleSave() {
		updateClient.mutate(
			{ id: client.id, payload: { name: name.trim(), companyName: companyName.trim(), email: email.trim() } },
			{
				onSuccess: () => {
					pushToast("Client updated.");
					onDone();
				},
			},
		);
	}

	return (
		<TR className="h-14 bg-primary-soft/40">
			<TD>
				<input
					aria-label="Name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					className={inputClass}
					minLength={2}
					required
				/>
			</TD>
			<TD>
				<input
					aria-label="Company"
					value={companyName}
					onChange={(e) => setCompanyName(e.target.value)}
					className={inputClass}
					minLength={2}
					required
				/>
			</TD>
			<TD>
				<input
					aria-label="Email"
					type="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					className={inputClass}
					required
				/>
			</TD>
			<TD>
				<div className="flex justify-end gap-2">
					<Button variant="secondary" onClick={onDone}>
						Cancel
					</Button>
					<Button loading={updateClient.isPending} onClick={handleSave}>
						Save
					</Button>
				</div>
			</TD>
		</TR>
	);
}

function CreateClientForm({ onDone }: { onDone: () => void }) {
	const createClient = useCreateClient();
	const [name, setName] = useState("");
	const [companyName, setCompanyName] = useState("");
	const [email, setEmail] = useState("");

	function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
		e.preventDefault();
		createClient.mutate(
			{ name: name.trim(), companyName: companyName.trim(), email: email.trim() },
			{
				onSuccess: () => {
					pushToast("Client created.");
					onDone();
				},
			},
		);
	}

	return (
		<Card className="mb-4">
			<CardHeader title="New client" />
			<form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 p-4">
				<Field label="Name" htmlFor="name">
					<input
						id="name"
						required
						minLength={2}
						value={name}
						onChange={(e) => setName(e.target.value)}
						className={inputClass}
					/>
				</Field>
				<Field label="Company" htmlFor="companyName">
					<input
						id="companyName"
						required
						minLength={2}
						value={companyName}
						onChange={(e) => setCompanyName(e.target.value)}
						className={inputClass}
					/>
				</Field>
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
				<FieldButtonSlot>
					<div className="flex gap-2">
						<Button variant="secondary" onClick={onDone}>
							Cancel
						</Button>
						<Button type="submit" loading={createClient.isPending}>
							Create client
						</Button>
					</div>
				</FieldButtonSlot>
			</form>
		</Card>
	);
}

export function ClientListPage() {
	const { canWrite } = useAuth();
	const { q, page, setQ, setPage, clear } = useListParams();
	const clientsQuery = useClients(page, q || undefined);
	const [creating, setCreating] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);

	return (
		<>
			<PageHeader
				title="Clients"
				description="Companies you send tenders to."
				actions={
					canWrite ? (
						!creating && (
							<Button onClick={() => setCreating(true)}>
								<Plus className="size-3.5" aria-hidden="true" /> New client
							</Button>
						)
					) : (
						<DisabledAction reason="Read-only accounts cannot create clients">New client</DisabledAction>
					)
				}
			/>

			{creating && <CreateClientForm onDone={() => setCreating(false)} />}

			<div className="space-y-4">
				<SearchInput
					value={q}
					onSearch={setQ}
					placeholder="Search by name, company or email"
					className="w-full sm:w-80"
				/>

				{clientsQuery.error && <ErrorMessage error={clientsQuery.error} />}

				{clientsQuery.isLoading ? (
					<TableSkeleton rows={6} cols={4} />
				) : clientsQuery.data?.total === 0 ? (
					<EmptyState
						icon={q ? SearchX : Users}
						title={q ? "No clients match your search" : "No clients yet"}
						description={
							q ? "Try a different name, company or email." : "Add a client to start creating tenders."
						}
						action={
							q ? (
								<button
									type="button"
									onClick={clear}
									className="text-[13px] font-medium text-primary hover:underline"
								>
									Clear search
								</button>
							) : undefined
						}
					/>
				) : (
					<Table>
						<THead>
							<tr>
								<TH>Name</TH>
								<TH>Company</TH>
								<TH>Email</TH>
								<TH className="w-1">
									<span className="sr-only">Actions</span>
								</TH>
							</tr>
						</THead>
						<TBody>
							{(clientsQuery.data?.data ?? []).map((client) =>
								editingId === client.id ? (
									<ClientEditRow key={client.id} client={client} onDone={() => setEditingId(null)} />
								) : (
									<ClientRow key={client.id} client={client} onEdit={() => setEditingId(client.id)} />
								),
							)}
						</TBody>
					</Table>
				)}

				{clientsQuery.data && <Pagination meta={clientsQuery.data} onChange={setPage} />}
			</div>
		</>
	);
}
