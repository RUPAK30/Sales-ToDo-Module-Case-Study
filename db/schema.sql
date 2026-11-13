-- Shared Supabase schema for Ten Today + Every Rupee (Postgres). Run once in the Supabase SQL editor.
create table organisations (id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz default now());
create table people (id uuid primary key default gen_random_uuid(), org_id uuid references organisations not null, user_id uuid references auth.users,
  name text not null, role text not null check (role in ('rep','approver','finance','tax','receivables','warehouse','admin')), approval_limit_pct numeric default 0);
create table buyers (id uuid primary key default gen_random_uuid(), org_id uuid references organisations not null, name text not null, gstin text);
create table invoices (id uuid primary key default gen_random_uuid(), org_id uuid references organisations not null, buyer_id uuid references buyers not null,
  invoice_no text not null, invoice_date date not null, amount_paise bigint not null, unique (org_id, invoice_no));
-- Ten Today
create table discounts (id uuid primary key default gen_random_uuid(), org_id uuid references organisations not null, invoice_id uuid references invoices not null,
  pct numeric not null, requested_by uuid references people, approved_by uuid references people, route text check (route in ('gst','fin','service')),
  status text default 'requested', created_at timestamptz default now(), check (approved_by is null or approved_by <> requested_by));
create table credit_notes (id uuid primary key default gen_random_uuid(), discount_id uuid references discounts not null, cn_no text not null, issued_on date not null,
  ims text default 'pending' check (ims in ('pending','accepted','rejected')), ims_remark text);
create table tickets (id uuid primary key default gen_random_uuid(), org_id uuid references organisations not null, discount_id uuid references discounts,
  case_id uuid, control text not null, owner uuid references people, due_on date not null, rupees_paise bigint default 0, closed_at timestamptz);
create table signoffs (id uuid primary key default gen_random_uuid(), org_id uuid references organisations not null, week date not null, signed_by uuid references people not null,
  countersigned_by uuid references people, notes jsonb not null, fingerprint text not null, check (countersigned_by is null or countersigned_by <> signed_by));
-- Every Rupee
create table payments (id uuid primary key default gen_random_uuid(), org_id uuid references organisations not null, invoice_id uuid references invoices,
  utr text not null, amount_paise bigint not null, received_on date not null, unique (org_id, utr));   -- the UTR makes a repeated payment harmless
create table cases (id uuid primary key default gen_random_uuid(), org_id uuid references organisations not null, invoice_id uuid references invoices not null,
  short_paise bigint not null, reason text default 'Unexplained', owner uuid references people, status text default 'open', opened_on date default current_date);
-- One append-only, fingerprinted history for both apps (tamper-evident)
create table events (id bigserial primary key, org_id uuid references organisations not null, subject text not null, -- 'discount:<id>' or 'case:<id>'
  at timestamptz default now(), who uuid references people, what text not null, data jsonb default '{}', prev_hash text not null, hash text not null);
create rule no_update_events as on update to events do instead nothing;
create rule no_delete_events as on delete to events do instead nothing;
-- Row-level security: everyone sees only their organisation
do $$ declare t text; begin foreach t in array array['organisations','people','buyers','invoices','discounts','credit_notes','tickets','signoffs','payments','cases','events'] loop
  execute format('alter table %I enable row level security', t); end loop; end $$;
create policy own_org on invoices for all using (org_id in (select org_id from people where user_id = auth.uid()));
-- (repeat the same own_org policy for each table with org_id)
