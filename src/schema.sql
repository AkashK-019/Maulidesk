-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- Clean up existing tables if they exist
drop table if exists settings cascade;
drop table if exists labour_payments cascade;
drop table if exists labour_attendance cascade;
drop table if exists labour_master cascade;
drop table if exists inventory_items cascade;
drop table if exists invoices cascade;
drop table if exists quotations cascade;
drop table if exists profiles cascade;

drop type if exists user_role cascade;

-- ROLES ENUM
create type user_role as enum ('Admin', 'Staff');

-- 1. USERS & ROLES
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  role user_role default 'Staff',
  allowed_pages text[] default '{"dashboard", "projects", "quotations", "invoices", "inventory", "labour", "attendance", "finance"}'::text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. COMPANY SETTINGS
create table settings (
  id integer primary key default 1 check (id = 1),
  company_name text not null default 'Mauli Decorators',
  address text,
  phone text,
  email text,
  gst_number text,
  state text not null default 'Maharashtra',
  bank_name text,
  account_number text,
  ifsc_code text,
  branch_name text,
  signature_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Initialize default settings row
insert into settings (id, company_name, state) 
values (1, 'Mauli Decorators', 'Maharashtra')
on conflict (id) do nothing;

-- 3. INVENTORY ITEMS (Decorator stock)
create table inventory_items (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  category text not null, -- Fabrics, Furniture, Lighting, Flooring, Decor Items, Hardware, Tools, Consumables
  quantity_available numeric default 0,
  unit text not null, -- meters, pieces, sets, rolls, boxes
  low_stock_threshold numeric default 5,
  purchase_rate numeric default 0,
  selling_rate numeric default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3.1 PROJECTS table
create table projects (
  id             uuid default uuid_generate_v4() primary key,
  project_name   text not null,
  client_name    text not null,
  client_phone   text,
  client_email   text,
  client_address text,
  event_date     date,
  event_type     text default 'Wedding',
  status         text default 'Active',
  notes          text,
  created_at     timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. QUOTATIONS
create table quotations (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references projects(id) on delete set null,
  quotation_number text not null unique,
  quotation_date date default current_date,
  client_name text not null,
  client_email text,
  client_phone text,
  client_address text,
  client_state text not null default 'Maharashtra',
  scope_of_work text,
  items jsonb default '[]'::jsonb, -- Array of items: {name, qty, unit, rate, amount}
  amount numeric not null default 0, -- Base amount
  gst_percent numeric default 0,
  gst_type text not null default 'CGST_SGST', -- CGST_SGST or IGST
  gst_amount numeric default 0,
  cgst_amount numeric default 0,
  sgst_amount numeric default 0,
  igst_amount numeric default 0,
  total_amount numeric not null default 0,
  validity_days integer default 30,
  notes text,
  status text default 'Pending', -- Pending, Sent, Approved, Rejected
  payment_terms text,
  terms_conditions text,
  line_items jsonb default '[]'::jsonb,
  client_gst text,
  event_type text default 'Wedding',
  event_date date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. INVOICES
create table invoices (
  id uuid default uuid_generate_v4() primary key,
  quotation_id uuid references quotations on delete set null,
  project_id uuid references projects(id) on delete set null,
  invoice_number text not null unique,
  invoice_date date default current_date,
  due_date date,
  client_name text not null,
  client_email text,
  client_phone text,
  client_address text,
  client_state text not null default 'Maharashtra',
  items jsonb default '[]'::jsonb, -- Array of items: {name, qty, unit, rate, amount}
  amount numeric not null default 0, -- Base amount
  gst_percent numeric default 0,
  gst_type text not null default 'CGST_SGST', -- CGST_SGST or IGST
  gst_amount numeric default 0,
  cgst_amount numeric default 0,
  sgst_amount numeric default 0,
  igst_amount numeric default 0,
  total_amount numeric not null default 0,
  amount_paid numeric default 0,
  status text default 'Unpaid', -- Unpaid, Partially Paid, Paid, Overdue
  notes text,
  client_gst text,
  payment_terms text,
  terms_conditions text,
  line_items jsonb default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5.1 PAYMENT RECEIPTS
create table payment_receipts (
  id             uuid    default uuid_generate_v4() primary key,
  invoice_id     uuid    references invoices(id) on delete cascade,
  project_id     uuid    references projects(id) on delete set null,
  receipt_number text    not null unique,
  amount         numeric not null default 0,
  label          text    not null default 'Payment',
  payment_mode   text    not null default 'Cash',
  payment_date   date    default current_date,
  notes          text,
  created_at     timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. LABOUR MASTER
create table labour_master (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  mobile text,
  skill_type text, -- Draper, Florist, Lightman, Carpenter, Helper, Supervisor
  labour_type text not null default 'Individual', -- Individual or Group Member
  group_name text, -- If in a group, name of the group
  group_leader_id uuid references labour_master(id) on delete set null, -- Reference to the leader
  daily_wage numeric default 0,
  aadhaar_number text,
  bank_details text,
  crew_size integer default 1,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. LABOUR DAILY ATTENDANCE
create table labour_attendance (
  id uuid default uuid_generate_v4() primary key,
  labour_id uuid references labour_master on delete cascade,
  attendance_date date default current_date,
  shift text not null default 'Full Day', -- Morning, Evening, Night, Full Day
  status text not null, -- Present, Absent, Half Day
  working_hours numeric default 8,
  overtime_hours numeric default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(labour_id, attendance_date, shift)
);

-- 8. LABOUR WAGE PAYMENTS
create table labour_payments (
  id uuid default uuid_generate_v4() primary key,
  labour_id uuid references labour_master on delete cascade, -- Can be leader (for group payment) or individual
  is_group_payment boolean default false,
  payment_date date default current_date,
  amount_paid numeric not null,
  payment_mode text default 'Cash', -- Cash, Bank, UPI
  remarks text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Disable Row Level Security (RLS) on all tables to allow query operations
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE quotations DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_receipts DISABLE ROW LEVEL SECURITY;
ALTER TABLE labour_master DISABLE ROW LEVEL SECURITY;
ALTER TABLE labour_attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE labour_payments DISABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_project_id    ON invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_quotation_id  ON invoices(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotations_project_id  ON quotations(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number        ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_invoice_id ON payment_receipts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_project_id ON payment_receipts(project_id);
