import { useState } from "react";
import type { Client } from "../api/types";
import { Button } from "../components/Button";
import { ErrorMessage } from "../components/ErrorMessage";
import { Field, FieldButtonSlot } from "../components/Field";
import { PageLoader } from "../components/Spinner";
import { useClients, useCreateClient, useUpdateClient } from "../hooks/useClients";
import { inputClass } from "../lib/formStyles";
import { pushToast } from "../lib/toast";

function ClientRow({ client, onEdit }: { client: Client; onEdit: () => void }) {
	return (
		<tr className="border-t border-gray-100 hover:bg-gray-50">
			<td className="px-4 py-2">{client.name}</td>
			<td className="px-4 py-2">{client.companyName}</td>
			<td className="px-4 py-2">{client.email}</td>
			<td className="px-4 py-2 text-right">
				<Button variant="link" onClick={onEdit}>
					Editar
				</Button>
			</td>
		</tr>
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
					pushToast("Cliente actualizado.");
					onDone();
				},
			},
		);
	}

	return (
		<tr className="border-t border-gray-100 bg-blue-50/40">
			<td className="px-4 py-2">
				<input
					value={name}
					onChange={(e) => setName(e.target.value)}
					className={`${inputClass} py-1`}
					minLength={2}
					required
				/>
			</td>
			<td className="px-4 py-2">
				<input
					value={companyName}
					onChange={(e) => setCompanyName(e.target.value)}
					className={`${inputClass} py-1`}
					minLength={2}
					required
				/>
			</td>
			<td className="px-4 py-2">
				<input
					type="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					className={`${inputClass} py-1`}
					required
				/>
			</td>
			<td className="px-4 py-2 text-right">
				<div className="flex justify-end gap-2">
					<Button variant="secondary" onClick={onDone}>
						Cancelar
					</Button>
					<Button loading={updateClient.isPending} onClick={handleSave}>
						Guardar
					</Button>
				</div>
			</td>
		</tr>
	);
}

export function ClientListPage() {
	const clientsQuery = useClients();
	const createClient = useCreateClient();
	const [name, setName] = useState("");
	const [companyName, setCompanyName] = useState("");
	const [email, setEmail] = useState("");
	const [editingId, setEditingId] = useState<string | null>(null);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		createClient.mutate(
			{ name: name.trim(), companyName: companyName.trim(), email: email.trim() },
			{
				onSuccess: () => {
					setName("");
					setCompanyName("");
					setEmail("");
					pushToast("Cliente creado.");
				},
			},
		);
	}

	return (
		<div className="space-y-6">
			<form
				onSubmit={handleSubmit}
				className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4"
			>
				<Field label="Nombre" htmlFor="name">
					<input
						id="name"
						required
						minLength={2}
						value={name}
						onChange={(e) => setName(e.target.value)}
						className={inputClass}
					/>
				</Field>
				<Field label="Empresa" htmlFor="companyName">
					<input
						id="companyName"
						required
						minLength={2}
						value={companyName}
						onChange={(e) => setCompanyName(e.target.value)}
						className={inputClass}
					/>
				</Field>
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
				<FieldButtonSlot>
					<Button type="submit" loading={createClient.isPending}>
						Crear cliente
					</Button>
				</FieldButtonSlot>
			</form>

			<ErrorMessage error={createClient.error} />

			{clientsQuery.isLoading ? (
				<PageLoader />
			) : (
				<div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
					<table className="w-full text-sm">
						<thead className="text-left text-xs text-gray-500">
							<tr>
								<th className="px-4 py-2">Nombre</th>
								<th className="px-4 py-2">Empresa</th>
								<th className="px-4 py-2">Correo</th>
								<th className="px-4 py-2" />
							</tr>
						</thead>
						<tbody>
							{(clientsQuery.data ?? []).map((client) =>
								editingId === client.id ? (
									<ClientEditRow key={client.id} client={client} onDone={() => setEditingId(null)} />
								) : (
									<ClientRow key={client.id} client={client} onEdit={() => setEditingId(client.id)} />
								),
							)}
						</tbody>
					</table>
					{clientsQuery.data?.length === 0 && (
						<p className="px-4 py-6 text-center text-sm text-gray-500">No hay clientes todavía.</p>
					)}
				</div>
			)}
		</div>
	);
}
