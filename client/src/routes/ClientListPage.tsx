import { Plus, SearchX, Users } from "lucide-react";
import { useState } from "react";
import { fieldErrors } from "../api/errors";
import type { ArchivedFilter, Client } from "../api/types";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Card, CardHeader } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { ErrorMessage } from "../components/ErrorMessage";
import { Field, FieldButtonSlot, InlineFieldError } from "../components/Field";
import { PageHeader } from "../components/PageHeader";
import { Pagination } from "../components/Pagination";
import { SearchInput } from "../components/SearchInput";
import { TableSkeleton } from "../components/Skeleton";
import { Table, TBody, TD, TH, THead, TR } from "../components/Table";
import {
	useArchiveClient,
	useClients,
	useCreateClient,
	useRestoreClient,
	useUpdateClient,
} from "../hooks/useClients";
import { useListParams } from "../hooks/useListParams";
import { useAuth } from "../lib/AuthContext";
import { confirmAction } from "../lib/confirm";
import { fieldClass, inputClass } from "../lib/formStyles";
import { pushToast } from "../lib/toast";

function ClientRow({ client, onEdit }: { client: Client; onEdit: () => void }) {
	const { canWrite, isAdmin } = useAuth();
	const archiveClient = useArchiveClient();
	const restoreClient = useRestoreClient();
	const isArchived = client.archivedAt !== null;

	async function handleArchive() {
		const ok = await confirmAction({
			title: `Archive ${client.companyName}?`,
			description:
				"It will disappear from lists and cannot be used for new tenders. Its existing tenders are kept. You can restore it later.",
			confirmLabel: "Archive client",
			destructive: true,
		});
		if (!ok) return;
		archiveClient.mutate(client.id, { onSuccess: () => pushToast("Client archived.") });
	}

	async function handleRestore() {
		const ok = await confirmAction({
			title: `Restore ${client.companyName}?`,
			description: "It will appear in lists again and can be used for new tenders.",
			confirmLabel: "Restore client",
		});
		if (!ok) return;
		restoreClient.mutate(client.id, { onSuccess: () => pushToast("Client restored.") });
	}

	return (
		<TR>
			<TD className="font-medium">
				{client.name} {isArchived && <Badge>Archived</Badge>}
			</TD>
			<TD>{client.companyName}</TD>
			<TD className="text-muted-foreground">{client.email}</TD>
			<TD className="text-right">
				<div className="flex justify-end gap-1">
					{canWrite && (
						<Button variant="ghost" onClick={onEdit}>
							Edit
						</Button>
					)}
					{isAdmin &&
						(isArchived ? (
							<Button variant="ghost" loading={restoreClient.isPending} onClick={handleRestore}>
								Restore
							</Button>
						) : (
							<Button variant="ghost" loading={archiveClient.isPending} onClick={handleArchive}>
								Archive
							</Button>
						))}
				</div>
			</TD>
		</TR>
	);
}

function ClientEditRow({ client, onDone }: { client: Client; onDone: () => void }) {
	const updateClient = useUpdateClient();
	const [name, setName] = useState(client.name);
	const [companyName, setCompanyName] = useState(client.companyName);
	const [email, setEmail] = useState(client.email);
	const errs = fieldErrors(updateClient.error);

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
					className={fieldClass(Boolean(errs.name))}
					aria-invalid={Boolean(errs.name)}
					aria-describedby={errs.name ? "edit-name-error" : undefined}
					minLength={2}
					required
				/>
				<InlineFieldError id="edit-name-error" message={errs.name} />
			</TD>
			<TD>
				<input
					aria-label="Company"
					value={companyName}
					onChange={(e) => setCompanyName(e.target.value)}
					className={fieldClass(Boolean(errs.companyName))}
					aria-invalid={Boolean(errs.companyName)}
					aria-describedby={errs.companyName ? "edit-company-error" : undefined}
					minLength={2}
					required
				/>
				<InlineFieldError id="edit-company-error" message={errs.companyName} />
			</TD>
			<TD>
				<input
					aria-label="Email"
					type="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					className={fieldClass(Boolean(errs.email))}
					aria-invalid={Boolean(errs.email)}
					aria-describedby={errs.email ? "edit-email-error" : undefined}
					required
				/>
				<InlineFieldError id="edit-email-error" message={errs.email} />
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
	const errs = fieldErrors(createClient.error);

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
				<Field label="Name" htmlFor="name" error={errs.name}>
					<input
						id="name"
						required
						minLength={2}
						value={name}
						onChange={(e) => setName(e.target.value)}
						className={fieldClass(Boolean(errs.name))}
					/>
				</Field>
				<Field label="Company" htmlFor="companyName" error={errs.companyName}>
					<input
						id="companyName"
						required
						minLength={2}
						value={companyName}
						onChange={(e) => setCompanyName(e.target.value)}
						className={fieldClass(Boolean(errs.companyName))}
					/>
				</Field>
				<Field label="Email" htmlFor="email" error={errs.email}>
					<input
						id="email"
						type="email"
						required
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						className={fieldClass(Boolean(errs.email))}
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
	const { canWrite, isAdmin } = useAuth();
	const { q, page, archived, setQ, setPage, setArchived, clear } = useListParams();
	const clientsQuery = useClients(page, q || undefined, isAdmin ? archived : undefined);
	const [creating, setCreating] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);

	return (
		<>
			<PageHeader
				title="Clients"
				description="Companies you send tenders to."
				actions={
					canWrite &&
					!creating && (
						<Button onClick={() => setCreating(true)}>
							<Plus className="size-3.5" aria-hidden="true" /> New client
						</Button>
					)
				}
			/>

			{creating && <CreateClientForm onDone={() => setCreating(false)} />}

			<div className="space-y-4">
				<div className="flex flex-wrap items-center gap-3">
					<SearchInput
						value={q}
						onSearch={setQ}
						placeholder="Search by name, company or email"
						className="w-full sm:w-80"
					/>
					{isAdmin && (
						<select
							aria-label="Archived clients"
							value={archived ?? ""}
							onChange={(e) => setArchived((e.target.value || undefined) as ArchivedFilter)}
							className={`${inputClass} w-auto`}
						>
							<option value="">Active clients</option>
							<option value="include">Active and archived</option>
							<option value="only">Archived only</option>
						</select>
					)}
				</div>

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
