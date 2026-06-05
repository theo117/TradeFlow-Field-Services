CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  vat_number TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  billing_plan TEXT,
  billing_status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('Admin', 'Office Staff', 'Technician')),
  performance NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  company_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  job_number TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  service_type TEXT NOT NULL CHECK (service_type IN ('Plumbing', 'Electrical')),
  priority TEXT NOT NULL CHECK (priority IN ('Low', 'Medium', 'High', 'Emergency')),
  description TEXT NOT NULL,
  address TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ,
  assigned_technician_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_technician_name TEXT,
  status TEXT NOT NULL CHECK (status IN ('New', 'Scheduled', 'In Progress', 'Waiting For Parts', 'On Hold', 'Completed', 'Invoiced')),
  labour_amount NUMERIC NOT NULL DEFAULT 0,
  timeline JSONB NOT NULL DEFAULT '[]'::JSONB,
  materials JSONB NOT NULL DEFAULT '[]'::JSONB,
  photos JSONB NOT NULL DEFAULT '[]'::JSONB,
  signature_customer_name TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  update_type TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  stage TEXT NOT NULL CHECK (stage IN ('Before', 'During', 'After')),
  file_url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  signature_url TEXT,
  completion_notes TEXT,
  signed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  quote_number TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  labour_amount NUMERIC NOT NULL DEFAULT 0,
  materials_amount NUMERIC NOT NULL DEFAULT 0,
  vat_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('Draft', 'Sent', 'Approved', 'Rejected')),
  converted_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  job_number TEXT,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  labour_amount NUMERIC NOT NULL DEFAULT 0,
  materials_amount NUMERIC NOT NULL DEFAULT 0,
  vat_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('Draft', 'Sent', 'Paid', 'Overdue')),
  due_at DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  notification_type TEXT NOT NULL,
  message TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whatsapp_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  provider TEXT,
  business_number TEXT,
  assignment_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  status_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  completion_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  invoice_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  template_name TEXT NOT NULL,
  language_code TEXT NOT NULL DEFAULT 'en',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whatsapp_message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  template_id UUID REFERENCES whatsapp_templates(id) ON DELETE SET NULL,
  recipient_phone TEXT NOT NULL,
  message_status TEXT NOT NULL DEFAULT 'Queued',
  provider_message_id TEXT,
  error_message TEXT,
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS technician_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  technician_id UUID REFERENCES users(id) ON DELETE CASCADE,
  technician_name TEXT,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  accuracy_meters NUMERIC,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  technician_id UUID REFERENCES users(id) ON DELETE SET NULL,
  technician_name TEXT,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  stop_order INTEGER NOT NULL DEFAULT 1,
  stop_name TEXT NOT NULL,
  address TEXT NOT NULL,
  planned_eta TIME,
  arrival_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'Planned',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  material_name TEXT NOT NULL,
  sku TEXT,
  category TEXT,
  supplier TEXT,
  quantity_on_hand NUMERIC NOT NULL DEFAULT 0,
  reorder_level NUMERIC NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('Stock In', 'Stock Out', 'Adjustment')),
  quantity NUMERIC NOT NULL,
  unit_cost NUMERIC,
  note TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL,
  billing_status TEXT NOT NULL DEFAULT 'Active',
  billing_email TEXT,
  seats INTEGER NOT NULL DEFAULT 1,
  monthly_amount NUMERIC NOT NULL DEFAULT 0,
  current_period_start DATE,
  current_period_end DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_company_status ON jobs(company_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_technician_schedule ON jobs(assigned_technician_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_customers_company_name ON customers(company_id, company_name);
CREATE INDEX IF NOT EXISTS idx_invoices_company_status ON invoices(company_id, status);
CREATE INDEX IF NOT EXISTS idx_locations_technician_time ON technician_locations(technician_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_route_stops_order ON route_stops(company_id, stop_order);
CREATE INDEX IF NOT EXISTS idx_inventory_company_sku ON inventory_items(company_id, sku);
CREATE INDEX IF NOT EXISTS idx_subscriptions_company_status ON subscriptions(company_id, billing_status);
