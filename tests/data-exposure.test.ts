import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { login, postJson, uniqueName, withSql } from "./helpers";

// The provider's Data API (PostgREST) runs every request as `anon` or `authenticated`, so what
// those database roles can reach is exactly what the public project key can reach.
const API_ROLES = ["anon", "authenticated"] as const;

let admin: string;

beforeAll(async () => {
	admin = await login("admin@example.com", "AdminPass123!");
});

async function applicationTables() {
	const rows = await withSql(
		(sql) => sql`
			select c.relname as name, c.relrowsecurity as rls
			from pg_class c join pg_namespace n on n.oid = c.relnamespace
			where n.nspname = 'public' and c.relkind in ('r', 'p')
			order by c.relname`,
	);
	return rows.map((r) => ({ name: r.name as string, rls: r.rls as boolean }));
}

describe("row level security (SEC-03)", () => {
	it("SEC-03: the application schema has tables, and every one has RLS enabled", async () => {
		const tables = await applicationTables();

		expect(tables.length).toBeGreaterThanOrEqual(7);
		expect(tables.filter((t) => !t.rls).map((t) => t.name)).toEqual([]);
	});

	it("SEC-03: no policy exists in the application schema, so none grants anon or authenticated", async () => {
		const policies = await withSql(
			(sql) => sql`select tablename, policyname from pg_policies where schemaname = 'public'`,
		);

		expect(policies).toHaveLength(0);
	});
});

describe("database privileges (SEC-12)", () => {
	it("SEC-12: anon and authenticated hold no privilege on any application table", async () => {
		const grants = await withSql(
			(sql) => sql`
				select grantee, table_name, privilege_type from information_schema.role_table_grants
				where table_schema = 'public' and grantee in ('anon', 'authenticated')
				order by table_name, grantee, privilege_type`,
		);

		expect(grants).toEqual([]);
	});

	it("SEC-12: anon and authenticated hold no privilege on application sequences", async () => {
		const grants = await withSql(
			(sql) => sql`
				select c.relname as name, r.rolname as role
				from pg_class c
				join pg_namespace n on n.oid = c.relnamespace
				cross join (select rolname from pg_roles where rolname in ('anon', 'authenticated')) r
				where n.nspname = 'public' and c.relkind = 'S'
					and has_sequence_privilege(r.rolname, c.oid, 'USAGE, SELECT, UPDATE')`,
		);

		expect(grants).toEqual([]);
	});

	it.each(API_ROLES)("SEC-12: has_table_privilege is false for %s on every table and verb", async (role) => {
		const tables = await applicationTables();
		const verbs = ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"];
		const granted = await withSql(async (sql) => {
			const found: string[] = [];
			for (const { name } of tables) {
				for (const verb of verbs) {
					const [row] = await sql`select has_table_privilege(${role}, ${`public.${name}`}, ${verb}) as ok`;
					if (row.ok) found.push(`${name}:${verb}`);
				}
			}
			return found;
		});

		expect(granted).toEqual([]);
	});

	it("SEC-12: the Worker's own database role still reads and writes the tables", async () => {
		const [row] = await withSql((sql) => sql`select count(*)::int as n from profiles`);

		expect(row.n).toBeGreaterThan(0);
	});
});

describe("new tables are not exposed (SEC-13)", () => {
	it("SEC-13: a table created in the application schema is born without anon or authenticated privileges", async () => {
		const table = `sec13_probe_${crypto.randomUUID().slice(0, 8)}`;
		const grants = await withSql(async (sql) => {
			try {
				return await sql.begin(async (tx) => {
					await tx.unsafe(`create table public."${table}" (id serial primary key, note text)`);
					return tx`
						select grantee, privilege_type from information_schema.role_table_grants
						where table_schema = 'public' and table_name = ${table} and grantee in ('anon', 'authenticated')`;
				});
			} finally {
				await sql.unsafe(`drop table if exists public."${table}"`);
			}
		});

		expect(grants).toEqual([]);
	});

	it("SEC-13: a sequence created in the application schema is born without anon or authenticated privileges", async () => {
		const sequence = `sec13_seq_${crypto.randomUUID().slice(0, 8)}`;
		const grants = await withSql(async (sql) => {
			try {
				await sql.unsafe(`create sequence public."${sequence}"`);
				return await sql`
					select r.rolname as role from pg_roles r
					where r.rolname in ('anon', 'authenticated')
						and has_sequence_privilege(r.rolname, ${`public."${sequence}"`}, 'USAGE, SELECT, UPDATE')`;
			} finally {
				await sql.unsafe(`drop sequence if exists public."${sequence}"`);
			}
		});

		expect(grants).toEqual([]);
	});
});

describe("the provider data API cannot reach application data (SEC-14)", () => {
	it.each(API_ROLES)("SEC-14: acting as %s, reading any application table is denied", async (role) => {
		const tables = await applicationTables();

		for (const { name } of tables) {
			const attempt = withSql((sql) =>
				sql.begin(async (tx) => {
					await tx.unsafe(`set local role ${role}`);
					await tx.unsafe(`select * from public."${name}" limit 1`);
				}),
			);
			await expect(attempt, `${role} read ${name}`).rejects.toMatchObject({ code: "42501" });
		}
	});

	it.each(API_ROLES)("SEC-14: acting as %s, writing any application table is denied", async (role) => {
		const tables = await applicationTables();

		for (const { name } of tables) {
			for (const statement of [
				`insert into public."${name}" default values`,
				`update public."${name}" set id = id`,
				`delete from public."${name}"`,
			]) {
				const attempt = withSql((sql) =>
					sql.begin(async (tx) => {
						await tx.unsafe(`set local role ${role}`);
						await tx.unsafe(statement);
					}),
				);
				await expect(attempt, `${role}: ${statement}`).rejects.toMatchObject({ code: "42501" });
			}
		}
	});

	// Local Supabase runs without PostgREST (README), so there this proves the HTTP path returns no
	// data; against a full stack or the hosted project it exercises the real Data API.
	const dataApi = (path: string, init: RequestInit = {}, bearer?: string) =>
		fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
			...init,
			headers: {
				apikey: env.SUPABASE_PUBLISHABLE_KEY,
				"Content-Type": "application/json",
				...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
			},
		});

	it("SEC-14: reading application tables over the Data API with the public key returns no rows", async () => {
		const tables = await applicationTables();

		for (const { name } of tables) {
			for (const bearer of [undefined, admin]) {
				const res = await dataApi(`${name}?select=*&limit=1`, {}, bearer);
				const text = await res.text();
				expect(res.ok, `GET ${name} (${bearer ? "signed in" : "anonymous"}): ${text.slice(0, 80)}`).toBe(
					false,
				);
			}
		}
	});

	it("SEC-14: writing application tables over the Data API with the public key changes nothing", async () => {
		const name = uniqueName("SEC-14 client");
		const created = await postJson(
			"/api/clients",
			{ name: "Probe Contact", companyName: name, email: "delivered@resend.dev" },
			admin,
		);
		expect(created.status).toBe(201);
		const id = created.body.client.id as string;
		const stray = uniqueName("SEC-14 stray");

		// A signed-in session token is the strongest identity the public key can be paired with.
		for (const bearer of [undefined, admin]) {
			const attempts = [
				dataApi(
					"clients",
					{ method: "POST", body: JSON.stringify({ name: "x", company_name: stray }) },
					bearer,
				),
				dataApi(
					`clients?id=eq.${id}`,
					{ method: "PATCH", body: JSON.stringify({ company_name: "hacked" }) },
					bearer,
				),
				dataApi(`clients?id=eq.${id}`, { method: "DELETE" }, bearer),
			];
			for (const res of await Promise.all(attempts)) {
				expect(res.ok).toBe(false);
				await res.text();
			}
		}

		const [row] = await withSql((sql) => sql`select company_name from clients where id = ${id}`);
		expect(row.company_name).toBe(name);
		const strays = await withSql((sql) => sql`select id from clients where company_name = ${stray}`);
		expect(strays).toHaveLength(0);
	});
});
