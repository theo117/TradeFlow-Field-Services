const state = {
  view: "dashboard",
  role: "Admin",
  dark: localStorage.getItem("tradeflow-theme") !== "light",
  customerSearch: "",
  jobStatus: "All",
  selectedTechJob: null,
  inventorySearch: "",
  companySearch: "",
  loading: true,
  dbStatus: "Not configured",
};

let users = [];
let customers = [];
let jobs = [];
let quotes = [];
let invoices = [];
let notifications = [];
let companies = [];
let inventoryItems = [];
let routeStops = [];
let gpsPings = [];
let whatsappSettings = {
  provider: "",
  businessNumber: "",
  assignmentAlerts: true,
  statusAlerts: true,
  completionAlerts: true,
  invoiceAlerts: true,
};

const supabaseConfig = window.TRADEFLOW_SUPABASE || {};
const normalizedSupabaseUrl = normalizeSupabaseUrl(supabaseConfig.url);
const supabaseClient =
  window.supabase && normalizedSupabaseUrl && supabaseConfig.anonKey
    ? window.supabase.createClient(normalizedSupabaseUrl, supabaseConfig.anonKey)
    : null;

const isSupabaseReady = () => Boolean(supabaseClient);

function setDbStatus(status) {
  state.dbStatus = status;
}

function normalizeSupabaseUrl(url) {
  if (!url) return "";
  return url.trim().replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
}

function mapCompany(row) {
  return {
    id: row.id,
    name: row.name,
    vatNumber: row.vat_number || "",
    phone: row.phone || "",
    email: row.email || "",
    address: row.address || "",
    billingPlan: row.billing_plan || "Starter",
    billingStatus: row.billing_status || "Active",
  };
}

function mapUser(row) {
  return {
    id: row.id,
    name: row.full_name,
    role: row.role,
    email: row.email || "",
    phone: row.phone || "",
    performance: row.performance || 0,
  };
}

function mapCustomer(row) {
  return {
    id: row.id,
    name: row.customer_name,
    company: row.company_name || row.customer_name,
    phone: row.phone || "",
    email: row.email || "",
    address: row.address || "",
    notes: row.notes || "",
  };
}

function mapJob(row) {
  return {
    id: row.id,
    number: row.job_number,
    customerId: row.customer_id,
    serviceType: row.service_type,
    priority: row.priority,
    description: row.description,
    address: row.address,
    scheduledDate: (row.scheduled_at || "").replace("T", " ").slice(0, 16),
    technician: row.assigned_technician_name || "Unassigned",
    technicianId: row.assigned_technician_id,
    status: row.status,
    labour: row.labour_amount || 0,
    updates: row.timeline || [],
    materials: row.materials || [],
    photos: row.photos || [],
    signature: row.signature_customer_name || null,
  };
}

function mapQuote(row) {
  return {
    id: row.quote_number,
    dbId: row.id,
    customerId: row.customer_id,
    labour: Number(row.labour_amount || 0),
    materials: Number(row.materials_amount || 0),
    vat: Number(row.vat_amount || 0),
    status: row.status,
  };
}

function mapInvoice(row) {
  return {
    id: row.invoice_number,
    dbId: row.id,
    jobNumber: row.job_number || "Manual",
    customerId: row.customer_id,
    labour: Number(row.labour_amount || 0),
    materials: Number(row.materials_amount || 0),
    vat: Number(row.vat_amount || 0),
    status: row.status,
    due: row.due_at || "",
  };
}

function mapInventoryItem(row) {
  return {
    id: row.id,
    name: row.material_name,
    sku: row.sku || "",
    category: row.category || "",
    quantity: Number(row.quantity_on_hand || 0),
    reorderLevel: Number(row.reorder_level || 0),
    unitCost: Number(row.unit_cost || 0),
    supplier: row.supplier || "",
  };
}

function mapRouteStop(row) {
  return {
    id: row.id,
    technician: row.technician_name || "Unassigned",
    technicianId: row.technician_id,
    stopName: row.stop_name,
    address: row.address,
    eta: row.planned_eta || "",
    status: row.status || "Planned",
  };
}

function mapWhatsappSettings(row) {
  if (!row) return whatsappSettings;
  return {
    provider: row.provider || "",
    businessNumber: row.business_number || "",
    assignmentAlerts: row.assignment_alerts,
    statusAlerts: row.status_alerts,
    completionAlerts: row.completion_alerts,
    invoiceAlerts: row.invoice_alerts,
  };
}

async function fetchTable(table, orderColumn = "created_at") {
  const { data, error } = await supabaseClient.from(table).select("*").order(orderColumn, { ascending: false });
  if (error) throw error;
  return data || [];
}

async function loadData() {
  if (!isSupabaseReady()) {
    state.loading = false;
    setDbStatus("Supabase not configured");
    render();
    return;
  }

  try {
    setDbStatus("Loading Supabase data");
    render();
    const [companyRows, userRows, customerRows, jobRows, quoteRows, invoiceRows, notificationRows, inventoryRows, routeRows, whatsappRows] =
      await Promise.all([
        fetchTable("companies"),
        fetchTable("users"),
        fetchTable("customers"),
        fetchTable("jobs"),
        fetchTable("quotes"),
        fetchTable("invoices"),
        fetchTable("notifications"),
        fetchTable("inventory_items"),
        fetchTable("route_stops"),
        fetchTable("whatsapp_settings"),
      ]);

    companies = companyRows.map(mapCompany);
    users = userRows.map(mapUser);
    customers = customerRows.map(mapCustomer);
    jobs = jobRows.map(mapJob);
    quotes = quoteRows.map(mapQuote);
    invoices = invoiceRows.map(mapInvoice);
    notifications = notificationRows.map((row) => ({
      id: row.id,
      type: row.notification_type,
      text: row.message,
      time: row.created_at ? new Date(row.created_at).toLocaleString() : "",
      unread: !row.read_at,
    }));
    inventoryItems = inventoryRows.map(mapInventoryItem);
    routeStops = routeRows.map(mapRouteStop).reverse();
    whatsappSettings = mapWhatsappSettings(whatsappRows[0]);
    state.loading = false;
    setDbStatus("Connected to Supabase");
    render();
  } catch (error) {
    state.loading = false;
    setDbStatus(`Supabase error: ${error.message}`);
    render();
  }
}

async function insertInto(table, payload) {
  if (!isSupabaseReady()) return null;
  const { data, error } = await supabaseClient.from(table).insert(payload).select().single();
  if (error) throw error;
  return data;
}

async function upsertInto(table, payload, onConflict = "id") {
  if (!isSupabaseReady()) return null;
  const { data, error } = await supabaseClient.from(table).upsert(payload, { onConflict }).select().single();
  if (error) throw error;
  return data;
}

function activeCompanyId() {
  return companies[0]?.id || null;
}

const navItems = [
  ["dashboard", "LayoutDashboard", "Dashboard"],
  ["jobs", "BriefcaseBusiness", "Jobs"],
  ["customers", "Users", "Customers"],
  ["dispatch", "Map", "Dispatch"],
  ["inventory", "Boxes", "Inventory"],
  ["technician", "Smartphone", "Technician"],
  ["quotes", "FileText", "Quotes"],
  ["invoices", "Receipt", "Invoices"],
  ["analytics", "ChartNoAxesCombined", "Analytics"],
  ["whatsapp", "MessageCircle", "WhatsApp"],
  ["companies", "Building2", "Companies"],
  ["notifications", "Bell", "Notifications"],
];

const money = (value) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(value);

const slug = (value) => value.toLowerCase().replaceAll(" ", "-");
const customerById = (id) => customers.find((customer) => customer.id === id) || { company: "Unassigned customer", name: "", address: "" };
const materialTotal = (job) => job.materials.reduce((sum, item) => sum + item.quantity * item.cost, 0);
const invoiceTotal = (record) => record.labour + record.materials + record.vat;
const todayJobs = () => jobs.filter((job) => job.scheduledDate.startsWith("2026-06-05"));

function emptyState(icon, title, message) {
  return `
    <div class="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-900">
      <i data-lucide="${icon}" class="mx-auto h-8 w-8 text-slate-400"></i>
      <h3 class="mt-3 text-base font-bold">${title}</h3>
      <p class="mx-auto mt-1 max-w-md text-sm text-slate-500">${message}</p>
    </div>
  `;
}

function setView(view) {
  state.view = view;
  render();
}

function setRole(role) {
  state.role = role;
  if (role === "Technician") state.view = "technician";
  render();
}

function toggleTheme() {
  state.dark = !state.dark;
  localStorage.setItem("tradeflow-theme", state.dark ? "dark" : "light");
  render();
}

async function saveWhatsappSettings(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const nextSettings = {
    provider: data.get("provider"),
    businessNumber: data.get("businessNumber"),
    assignmentAlerts: data.has("assignmentAlerts"),
    statusAlerts: data.has("statusAlerts"),
    completionAlerts: data.has("completionAlerts"),
    invoiceAlerts: data.has("invoiceAlerts"),
  };
  try {
    const row = await upsertInto(
      "whatsapp_settings",
      {
        id: "default",
        company_id: activeCompanyId(),
        provider: nextSettings.provider,
        business_number: nextSettings.businessNumber,
        assignment_alerts: nextSettings.assignmentAlerts,
        status_alerts: nextSettings.statusAlerts,
        completion_alerts: nextSettings.completionAlerts,
        invoice_alerts: nextSettings.invoiceAlerts,
        updated_at: new Date().toISOString(),
      },
      "id",
    );
    whatsappSettings = row ? mapWhatsappSettings(row) : nextSettings;
    setDbStatus(isSupabaseReady() ? "Saved to Supabase" : "Supabase not configured");
  } catch (error) {
    setDbStatus(`Save failed: ${error.message}`);
    whatsappSettings = nextSettings;
  }
  notifications = [
    { type: "whatsapp", text: "WhatsApp alert settings updated", time: "Just now", unread: true },
    ...notifications,
  ];
  render();
}

async function addInventoryItem(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const item = {
      id: crypto.randomUUID(),
      name: data.get("name"),
      sku: data.get("sku"),
      category: data.get("category"),
      quantity: Number(data.get("quantity") || 0),
      reorderLevel: Number(data.get("reorderLevel") || 0),
      unitCost: Number(data.get("unitCost") || 0),
      supplier: data.get("supplier"),
    };
  try {
    const row = await insertInto("inventory_items", {
      id: item.id,
      company_id: activeCompanyId(),
      material_name: item.name,
      sku: item.sku,
      category: item.category,
      supplier: item.supplier,
      quantity_on_hand: item.quantity,
      reorder_level: item.reorderLevel,
      unit_cost: item.unitCost,
    });
    inventoryItems = [row ? mapInventoryItem(row) : item, ...inventoryItems];
    setDbStatus(isSupabaseReady() ? "Saved to Supabase" : "Supabase not configured");
  } catch (error) {
    setDbStatus(`Save failed: ${error.message}`);
    inventoryItems = [item, ...inventoryItems];
  }
  event.currentTarget.reset();
  render();
}

async function addRouteStop(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const technicianName = data.get("technician");
  const technician = users.find((user) => user.name === technicianName);
  const stop = {
      id: crypto.randomUUID(),
      technician: technicianName,
      technicianId: technician?.id || null,
      stopName: data.get("stopName"),
      address: data.get("address"),
      eta: data.get("eta"),
      status: "Planned",
    };
  try {
    const row = await insertInto("route_stops", {
      id: stop.id,
      company_id: activeCompanyId(),
      technician_id: stop.technicianId,
      technician_name: stop.technician,
      stop_name: stop.stopName,
      address: stop.address,
      planned_eta: stop.eta,
      status: stop.status,
      stop_order: routeStops.length + 1,
    });
    routeStops = [...routeStops, row ? mapRouteStop(row) : stop];
    setDbStatus(isSupabaseReady() ? "Saved to Supabase" : "Supabase not configured");
  } catch (error) {
    setDbStatus(`Save failed: ${error.message}`);
    routeStops = [...routeStops, stop];
  }
  event.currentTarget.reset();
  render();
}

async function addCompany(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const company = {
      id: crypto.randomUUID(),
      name: data.get("name"),
      vatNumber: data.get("vatNumber"),
      phone: data.get("phone"),
      email: data.get("email"),
      address: data.get("address"),
      billingPlan: data.get("billingPlan"),
      billingStatus: "Active",
    };
  try {
    const row = await insertInto("companies", {
      id: company.id,
      name: company.name,
      vat_number: company.vatNumber,
      phone: company.phone,
      email: company.email,
      address: company.address,
      billing_plan: company.billingPlan,
      billing_status: company.billingStatus,
    });
    companies = [row ? mapCompany(row) : company, ...companies];
    setDbStatus(isSupabaseReady() ? "Saved to Supabase" : "Supabase not configured");
  } catch (error) {
    setDbStatus(`Save failed: ${error.message}`);
    companies = [company, ...companies];
  }
  event.currentTarget.reset();
  render();
}

async function addCustomer(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const customer = {
      id: crypto.randomUUID(),
      name: data.get("name"),
      company: data.get("company"),
      phone: data.get("phone"),
      email: data.get("email"),
      address: data.get("address"),
      notes: data.get("notes"),
    };
  try {
    const row = await insertInto("customers", {
      id: customer.id,
      company_id: activeCompanyId(),
      customer_name: customer.name,
      company_name: customer.company,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      notes: customer.notes,
    });
    customers = [row ? mapCustomer(row) : customer, ...customers];
    setDbStatus(isSupabaseReady() ? "Saved to Supabase" : "Supabase not configured");
  } catch (error) {
    setDbStatus(`Save failed: ${error.message}`);
    customers = [customer, ...customers];
  }
  event.currentTarget.reset();
  render();
}

async function addTechnician(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const technician = {
      id: crypto.randomUUID(),
      name: data.get("name"),
      role: "Technician",
      email: data.get("email"),
      phone: data.get("phone"),
      performance: 0,
    };
  try {
    const row = await insertInto("users", {
      id: technician.id,
      company_id: activeCompanyId(),
      full_name: technician.name,
      role: technician.role,
      email: technician.email || null,
      phone: technician.phone,
      performance: technician.performance,
    });
    users = [row ? mapUser(row) : technician, ...users];
    setDbStatus(isSupabaseReady() ? "Saved to Supabase" : "Supabase not configured");
  } catch (error) {
    setDbStatus(`Save failed: ${error.message}`);
    users = [technician, ...users];
  }
  event.currentTarget.reset();
  render();
}

async function addQuote(event) {
  event.preventDefault();
  if (!customers.length) return;
  const data = new FormData(event.currentTarget);
  const labour = Number(data.get("labour") || 0);
  const materials = Number(data.get("materials") || 0);
  const vat = Number(data.get("vat") || 0);
  const quote = {
      id: `Q-${String(quotes.length + 1).padStart(4, "0")}`,
      customerId: data.get("customer"),
      labour,
      materials,
      vat,
      status: data.get("status"),
    };
  try {
    const row = await insertInto("quotes", {
      id: crypto.randomUUID(),
      company_id: activeCompanyId(),
      quote_number: quote.id,
      customer_id: quote.customerId,
      labour_amount: quote.labour,
      materials_amount: quote.materials,
      vat_amount: quote.vat,
      total_amount: quote.labour + quote.materials + quote.vat,
      status: quote.status,
    });
    quotes = [row ? mapQuote(row) : quote, ...quotes];
    setDbStatus(isSupabaseReady() ? "Saved to Supabase" : "Supabase not configured");
  } catch (error) {
    setDbStatus(`Save failed: ${error.message}`);
    quotes = [quote, ...quotes];
  }
  event.currentTarget.reset();
  render();
}

async function addInvoice(event) {
  event.preventDefault();
  if (!customers.length) return;
  const data = new FormData(event.currentTarget);
  const labour = Number(data.get("labour") || 0);
  const materials = Number(data.get("materials") || 0);
  const vat = Number(data.get("vat") || 0);
  const invoice = {
      id: `INV-${String(invoices.length + 1).padStart(4, "0")}`,
      jobNumber: data.get("jobNumber") || "Manual",
      customerId: data.get("customer"),
      labour,
      materials,
      vat,
      status: data.get("status"),
      due: data.get("due"),
    };
  try {
    const row = await insertInto("invoices", {
      id: crypto.randomUUID(),
      company_id: activeCompanyId(),
      invoice_number: invoice.id,
      job_number: invoice.jobNumber,
      customer_id: invoice.customerId,
      labour_amount: invoice.labour,
      materials_amount: invoice.materials,
      vat_amount: invoice.vat,
      total_amount: invoice.labour + invoice.materials + invoice.vat,
      status: invoice.status,
      due_at: invoice.due || null,
    });
    invoices = [row ? mapInvoice(row) : invoice, ...invoices];
    setDbStatus(isSupabaseReady() ? "Saved to Supabase" : "Supabase not configured");
  } catch (error) {
    setDbStatus(`Save failed: ${error.message}`);
    invoices = [invoice, ...invoices];
  }
  event.currentTarget.reset();
  render();
}

async function updateJobStatus(number, status) {
  jobs = jobs.map((job) =>
    job.number === number
      ? {
          ...job,
          status,
          updates: [`Status changed to ${status}`, ...job.updates],
        }
      : job,
  );
  const job = jobs.find((item) => item.number === number);
  if (isSupabaseReady() && job?.id) {
    const { error } = await supabaseClient.from("jobs").update({ status, timeline: job.updates }).eq("id", job.id);
    setDbStatus(error ? `Save failed: ${error.message}` : "Saved to Supabase");
  }
  notifications = [
    { type: "status", text: `${number} moved to ${status}`, time: "Just now", unread: true },
    ...notifications,
  ];
  render();
}

async function addJob(event) {
  event.preventDefault();
  if (!customers.length || !users.some((user) => user.role === "Technician")) return;
  const data = new FormData(event.currentTarget);
  const currentNumbers = jobs.map((job) => Number(job.number.replace("TF-", ""))).filter(Number.isFinite);
  const nextNumberValue = (currentNumbers.length ? Math.max(...currentNumbers) : 1000) + 1;
  const nextNumber = `TF-${nextNumberValue}`;
  const technicianName = data.get("technician");
  const technician = users.find((user) => user.name === technicianName);
  const job = {
      id: crypto.randomUUID(),
      number: nextNumber,
      customerId: data.get("customer"),
      serviceType: data.get("serviceType"),
      priority: data.get("priority"),
      description: data.get("description"),
      address: data.get("address"),
      scheduledDate: data.get("scheduledDate").replace("T", " "),
      technician: technicianName,
      technicianId: technician?.id || null,
      status: "Scheduled",
      labour: 0,
      updates: ["Job created from office intake"],
      materials: [],
      photos: [],
      signature: null,
    };
  try {
    const row = await insertInto("jobs", {
      id: job.id,
      company_id: activeCompanyId(),
      job_number: job.number,
      customer_id: job.customerId,
      service_type: job.serviceType,
      priority: job.priority,
      description: job.description,
      address: job.address,
      scheduled_at: job.scheduledDate,
      assigned_technician_id: job.technicianId,
      assigned_technician_name: job.technician,
      status: job.status,
      labour_amount: job.labour,
      timeline: job.updates,
      materials: job.materials,
      photos: job.photos,
    });
    jobs = [row ? mapJob(row) : job, ...jobs];
    setDbStatus(isSupabaseReady() ? "Saved to Supabase" : "Supabase not configured");
  } catch (error) {
    setDbStatus(`Save failed: ${error.message}`);
    jobs = [job, ...jobs];
  }
  notifications = [
    { type: "assignment", text: `${data.get("technician")} assigned to ${nextNumber}`, time: "Just now", unread: true },
    ...notifications,
  ];
  event.currentTarget.reset();
  render();
}

async function completeTechnicianJob(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const number = state.selectedTechJob;
  let completedJob = null;
  jobs = jobs.map((job) => {
    if (job.number !== number) return job;
    const materialName = data.get("materialName");
    const newMaterial = materialName
      ? [{ name: materialName, quantity: Number(data.get("quantity") || 1), cost: Number(data.get("cost") || 0) }]
      : [];
    completedJob = {
      ...job,
      status: "Completed",
      signature: data.get("customerName"),
      photos: [...job.photos, "Before upload", "After upload"].filter(Boolean),
      materials: [...job.materials, ...newMaterial],
      updates: [
        `Completion notes: ${data.get("completionNotes")}`,
        `Customer sign-off captured: ${data.get("customerName")}`,
        ...job.updates,
      ],
    };
    return completedJob;
  });
  if (isSupabaseReady() && completedJob?.id) {
    const { error } = await supabaseClient
      .from("jobs")
      .update({
        status: completedJob.status,
        signature_customer_name: completedJob.signature,
        materials: completedJob.materials,
        photos: completedJob.photos,
        timeline: completedJob.updates,
        completed_at: new Date().toISOString(),
      })
      .eq("id", completedJob.id);
    setDbStatus(error ? `Save failed: ${error.message}` : "Saved to Supabase");
  }
  notifications = [
    { type: "complete", text: `${number} completed with customer sign-off`, time: "Just now", unread: true },
    ...notifications,
  ];
  render();
}

function layout(content) {
  document.documentElement.classList.toggle("dark", state.dark);
  const allowedNav = state.role === "Technician" ? navItems.filter(([key]) => key === "technician" || key === "dashboard" || key === "dispatch") : navItems;
  return `
    <div class="flex min-h-screen">
      <aside class="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-slate-200 bg-white px-4 py-5 dark:border-slate-800 dark:bg-slate-950 lg:block">
        <div class="mb-7 flex items-center gap-3 px-2">
          <div class="grid h-11 w-11 place-items-center rounded-lg bg-brand-600 text-white">
            <i data-lucide="Wrench" class="h-5 w-5"></i>
          </div>
          <div>
            <p class="text-sm font-bold tracking-wide text-brand-600">TradeFlow</p>
            <h1 class="text-lg font-extrabold">Field Services</h1>
          </div>
        </div>
        <nav class="space-y-1">
          ${allowedNav
            .map(
              ([key, icon, label]) => `
              <button aria-current="${state.view === key ? "page" : "false"}" class="nav-button flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900" onclick="setView('${key}')">
                <i data-lucide="${icon}" class="h-4 w-4"></i>${label}
              </button>`,
            )
            .join("")}
        </nav>
      </aside>
      <main class="min-w-0 flex-1 lg:pl-72">
        <header class="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
          <div class="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div>
              <p class="text-xs font-bold uppercase text-brand-600">Commercial SaaS Operations</p>
              <h2 class="text-xl font-extrabold sm:text-2xl">${pageTitle()}</h2>
              <p class="mt-1 text-xs font-semibold text-slate-500">${state.dbStatus}</p>
            </div>
            <div class="flex items-center gap-2">
              <select class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" onchange="setRole(this.value)">
                ${["Admin", "Office Staff", "Technician"].map((role) => `<option ${state.role === role ? "selected" : ""}>${role}</option>`).join("")}
              </select>
              <button class="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900" onclick="toggleTheme()" title="Toggle dark mode">
                <i data-lucide="${state.dark ? "Sun" : "Moon"}" class="h-4 w-4"></i>
              </button>
              <button class="relative grid h-10 w-10 place-items-center rounded-lg bg-brand-600 text-white" onclick="setView('notifications')" title="Notifications">
                <i data-lucide="Bell" class="h-4 w-4"></i>
                <span class="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-rose-500 text-[11px] font-bold">${notifications.filter((item) => item.unread).length}</span>
              </button>
            </div>
          </div>
          <div class="flex gap-2 overflow-x-auto px-4 pb-3 lg:hidden">
            ${allowedNav
              .map(
                ([key, icon, label]) => `
                <button class="nav-button flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300" aria-current="${state.view === key ? "page" : "false"}" onclick="setView('${key}')">
                  <i data-lucide="${icon}" class="h-4 w-4"></i>${label}
                </button>`,
              )
              .join("")}
          </div>
        </header>
        <div class="px-4 py-5 sm:px-6">${content}</div>
      </main>
    </div>
  `;
}

function pageTitle() {
  return {
    dashboard: "Operations Dashboard",
    jobs: "Job Management",
    customers: "Customer Management",
    dispatch: "GPS & Route Planning",
    inventory: "Inventory Management",
    technician: "Technician Mobile View",
    quotes: "Quotes",
    invoices: "Invoices",
    analytics: "Analytics",
    whatsapp: "WhatsApp Alerts",
    companies: "Companies & Billing",
    notifications: "Notification Center",
  }[state.view];
}

function dashboardView() {
  const monthlyRevenue = invoices.filter((invoice) => invoice.status === "Paid").reduce((sum, invoice) => sum + invoiceTotal(invoice), 0);
  const outstanding = invoices.filter((invoice) => invoice.status !== "Paid").reduce((sum, invoice) => sum + invoiceTotal(invoice), 0);
  const metrics = [
    ["CalendarDays", "Jobs Scheduled Today", todayJobs().length, "No scheduled jobs yet"],
    ["Activity", "Jobs In Progress", jobs.filter((job) => job.status === "In Progress").length, "No active work yet"],
    ["BadgeCheck", "Completed Jobs", jobs.filter((job) => job.status === "Completed").length, "No completions yet"],
    ["Receipt", "Outstanding Invoices", money(outstanding), "No invoice balance yet"],
    ["Banknote", "Monthly Revenue", money(monthlyRevenue), "No paid revenue yet"],
  ];
  return `
    <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      ${metrics.map(([icon, label, value, note]) => metricCard(icon, label, value, note)).join("")}
    </section>
    <section class="mt-5 grid gap-5 xl:grid-cols-[1.4fr_.8fr]">
      <div class="glass-panel rounded-lg p-5">
        <div class="mb-5 flex items-center justify-between">
          <div>
            <h3 class="text-lg font-bold">Daily Job Flow</h3>
            <p class="text-sm text-slate-500">Scheduled, active, completed, invoiced</p>
          </div>
          <span class="rounded-lg bg-brand-50 px-3 py-1 text-sm font-bold text-brand-700 dark:bg-brand-950">June 2026</span>
        </div>
        <div class="grid h-64 grid-cols-7 items-end gap-3">
          ${[0, 0, 0, 0, 0, 0, 0].map((height, index) => `<div class="flex h-full flex-col justify-end gap-2"><div class="chart-bar" style="height:${height}%"></div><span class="text-center text-xs font-semibold text-slate-500">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index]}</span></div>`).join("")}
        </div>
      </div>
      <div class="glass-panel rounded-lg p-5">
        <h3 class="text-lg font-bold">Technician Performance</h3>
        <div class="mt-4 space-y-4">
          ${users.filter((user) => user.role === "Technician").length
            ? users
            .filter((user) => user.role === "Technician")
            .map(
              (user) => `
              <div>
                <div class="mb-1 flex justify-between text-sm font-semibold"><span>${user.name}</span><span>${user.performance}%</span></div>
                <div class="h-2 rounded-full bg-slate-200 dark:bg-slate-800"><div class="h-2 rounded-full bg-brand-600" style="width:${user.performance}%"></div></div>
              </div>`,
            )
            .join("")
            : emptyState("UserRoundPlus", "No technicians yet", "Add technician users to begin tracking productivity.")}
        </div>
      </div>
    </section>
    <section class="mt-5 grid gap-5 xl:grid-cols-[1fr_.9fr]">
      ${jobsPanel()}
      ${activityFeed()}
    </section>
  `;
}

function metricCard(icon, label, value, note) {
  return `
    <article class="metric-card">
      <div class="mb-4 flex items-center justify-between">
        <span class="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-slate-900"><i data-lucide="${icon}" class="h-5 w-5"></i></span>
      </div>
      <p class="text-sm font-semibold text-slate-500">${label}</p>
      <p class="mt-1 text-2xl font-extrabold">${value}</p>
      <p class="mt-2 text-xs font-semibold text-emerald-600">${note}</p>
    </article>
  `;
}

function jobsPanel() {
  return `
    <div class="glass-panel rounded-lg p-5">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="text-lg font-bold">Live Job Board</h3>
        <button class="rounded-lg bg-brand-600 px-3 py-2 text-sm font-bold text-white" onclick="setView('jobs')">Open Jobs</button>
      </div>
      <div class="space-y-3">
        ${jobs.length ? jobs.slice(0, 4).map(jobSummary).join("") : emptyState("BriefcaseBusiness", "No jobs yet", "Create your first service job once customers and technicians have been added.")}
      </div>
    </div>
  `;
}

function jobSummary(job) {
  return `
    <article class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <strong>${job.number}</strong>
            <span class="status-pill status-${slug(job.status)}">${job.status}</span>
            <span class="priority-pill priority-${slug(job.priority)}">${job.priority}</span>
          </div>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">${job.description}</p>
        </div>
        <p class="text-sm font-bold text-brand-600">${job.technician}</p>
      </div>
      <div class="mt-3 grid gap-2 text-sm text-slate-500 sm:grid-cols-3">
        <span>${customerById(job.customerId).company}</span>
        <span>${job.serviceType}</span>
        <span>${job.scheduledDate}</span>
      </div>
    </article>
  `;
}

function activityFeed() {
  return `
    <div class="glass-panel rounded-lg p-5">
      <h3 class="text-lg font-bold">Recent Activity Feed</h3>
      <div class="mt-4 space-y-4">
        ${notifications.length
          ? notifications
          .slice(0, 6)
          .map(
            (item) => `
          <div class="flex gap-3">
            <span class="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-slate-900">
              <i data-lucide="${notificationIcon(item.type)}" class="h-4 w-4"></i>
            </span>
            <div>
              <p class="text-sm font-semibold">${item.text}</p>
              <p class="text-xs text-slate-500">${item.time}</p>
            </div>
          </div>`,
          )
          .join("")
          : emptyState("Bell", "No activity yet", "Notifications will appear here when jobs, invoices, and assignments change.")}
      </div>
    </div>
  `;
}

function jobsView() {
  const filtered = jobs.filter((job) => state.jobStatus === "All" || job.status === state.jobStatus);
  const canCreateJob = customers.length && users.some((user) => user.role === "Technician");
  return `
    <section class="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
      <form class="glass-panel rounded-lg p-5" onsubmit="addJob(event)">
        <h3 class="text-lg font-bold">Create Service Job</h3>
        ${canCreateJob ? "" : `<p class="mt-2 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">Add at least one customer and one technician before creating jobs.</p>`}
        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          ${selectField("customer", "Customer", customers.map((c) => [c.id, `${c.company} - ${c.name}`]))}
          ${selectField("serviceType", "Service Type", [["Plumbing", "Plumbing"], ["Electrical", "Electrical"]])}
          ${selectField("priority", "Priority", [["Low", "Low"], ["Medium", "Medium"], ["High", "High"], ["Emergency", "Emergency"]])}
          ${selectField("technician", "Assigned Technician", users.filter((u) => u.role === "Technician").map((u) => [u.name, u.name]))}
          <label class="sm:col-span-2 text-sm font-semibold">Description<textarea name="description" required class="mt-1 min-h-24 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"></textarea></label>
          <label class="sm:col-span-2 text-sm font-semibold">Address<input name="address" required class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
          <label class="text-sm font-semibold">Scheduled Date<input name="scheduledDate" type="datetime-local" required class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
        </div>
        <button ${canCreateJob ? "" : "disabled"} class="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400"><i data-lucide="Plus" class="h-4 w-4"></i>Create Job</button>
      </form>
      <div class="glass-panel overflow-hidden rounded-lg">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5 dark:border-slate-800">
          <h3 class="text-lg font-bold">Jobs</h3>
          <select class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" onchange="state.jobStatus=this.value; render();">
            ${["All", "New", "Scheduled", "In Progress", "Waiting For Parts", "On Hold", "Completed", "Invoiced"].map((status) => `<option ${state.jobStatus === status ? "selected" : ""}>${status}</option>`).join("")}
          </select>
        </div>
        <div class="overflow-x-auto">
          <table class="desktop-table w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
              <tr><th class="p-4">Job</th><th class="p-4">Customer</th><th class="p-4">Technician</th><th class="p-4">Status</th><th class="p-4">Material Cost</th><th class="p-4">Timeline</th></tr>
            </thead>
            <tbody>
              ${filtered.length
                ? filtered
                .map(
                  (job) => `
                  <tr class="border-t border-slate-200 dark:border-slate-800">
                    <td class="p-4"><strong>${job.number}</strong><p class="text-slate-500">${job.serviceType} · ${job.priority}</p></td>
                    <td class="p-4">${customerById(job.customerId).company}<p class="text-slate-500">${job.address}</p></td>
                    <td class="p-4">${job.technician}</td>
                    <td class="p-4"><span class="status-pill status-${slug(job.status)}">${job.status}</span></td>
                    <td class="p-4">${money(materialTotal(job))}</td>
                    <td class="p-4">${job.updates.slice(0, 2).map((update) => `<p class="text-slate-500">${update}</p>`).join("")}</td>
                  </tr>`,
                )
                .join("")
                : `<tr><td colspan="6" class="p-4">${emptyState("BriefcaseBusiness", "No jobs found", "Newly created jobs will appear in this table.")}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}

function customersView() {
  const query = state.customerSearch.toLowerCase();
  const filtered = customers.filter((customer) =>
    [customer.name, customer.company, customer.email, customer.address].some((value) => value.toLowerCase().includes(query)),
  );
  return `
    <section class="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
      <form class="glass-panel rounded-lg p-5" onsubmit="addCustomer(event)">
        <h3 class="text-lg font-bold">Add Customer</h3>
        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <label class="text-sm font-semibold">Customer Name<input name="name" required class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
          <label class="text-sm font-semibold">Company Name<input name="company" required class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
          <label class="text-sm font-semibold">Phone<input name="phone" class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
          <label class="text-sm font-semibold">Email<input name="email" type="email" class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
          <label class="sm:col-span-2 text-sm font-semibold">Address<input name="address" required class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
          <label class="sm:col-span-2 text-sm font-semibold">Notes<textarea name="notes" class="mt-1 min-h-24 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"></textarea></label>
        </div>
        <button class="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 font-bold text-white"><i data-lucide="Plus" class="h-4 w-4"></i>Add Customer</button>
      </form>
      <div class="glass-panel rounded-lg p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h3 class="text-lg font-bold">Customer Directory</h3>
          <label class="relative min-w-64 flex-1 sm:flex-none">
            <i data-lucide="Search" class="absolute left-3 top-3 h-4 w-4 text-slate-400"></i>
            <input value="${state.customerSearch}" oninput="state.customerSearch=this.value; render();" placeholder="Search customers" class="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 dark:border-slate-700 dark:bg-slate-900" />
          </label>
        </div>
        <div class="mt-5 grid gap-4">
          ${filtered.length
            ? filtered
            .map(
              (customer) => `
              <article class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <h4 class="font-extrabold">${customer.company}</h4>
                    <p class="text-sm text-slate-500">${customer.name}</p>
                  </div>
                  <span class="rounded-lg bg-brand-50 px-3 py-1 text-sm font-bold text-brand-700 dark:bg-slate-800">${jobs.filter((job) => job.customerId === customer.id).length} jobs</span>
                </div>
                <div class="mt-4 grid gap-2 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                  <span>${customer.phone || "No phone"}</span><span>${customer.email || "No email"}</span><span class="sm:col-span-2">${customer.address}</span>
                </div>
                <p class="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">${customer.notes || "No notes"}</p>
              </article>`,
            )
            .join("")
            : emptyState("Users", "No customers yet", "Customer records will appear here once they are added.")}
        </div>
      </div>
    </section>
  `;
}

function dispatchView() {
  const technicians = users.filter((user) => user.role === "Technician");
  const canPlanRoute = technicians.length > 0;
  return `
    <section class="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
      <div class="glass-panel rounded-lg p-5">
        <h3 class="text-lg font-bold">GPS Tracking</h3>
        <p class="mt-1 text-sm text-slate-500">Live technician location updates are stored as GPS pings and can be linked to assigned jobs.</p>
        <div class="mt-5 grid min-h-80 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
          ${gpsPings.length
            ? gpsPings
                .map(
                  (ping) => `
                  <article class="m-3 w-full max-w-md rounded-lg border border-slate-200 bg-white p-4 text-left dark:border-slate-800 dark:bg-slate-950">
                    <div class="flex items-center justify-between gap-3"><strong>${ping.technician}</strong><span class="text-sm text-slate-500">${ping.recordedAt}</span></div>
                    <p class="mt-2 text-sm text-slate-500">${ping.latitude}, ${ping.longitude}</p>
                  </article>`,
                )
                .join("")
            : emptyState("MapPin", "No GPS pings yet", "Technician location updates will appear here when mobile tracking is connected.")}
        </div>
      </div>
      <div class="glass-panel rounded-lg p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 class="text-lg font-bold">Route Planning</h3>
            <p class="mt-1 text-sm text-slate-500">Build route stops for technicians with manual dispatch planning.</p>
          </div>
          <span class="rounded-lg bg-brand-50 px-3 py-1 text-sm font-bold text-brand-700 dark:bg-slate-800">${routeStops.length} stops</span>
        </div>
        <form class="mt-5 grid gap-3 sm:grid-cols-2" onsubmit="addRouteStop(event)">
          ${selectField("technician", "Technician", technicians.map((user) => [user.name, user.name]))}
          <label class="text-sm font-semibold">ETA<input name="eta" type="time" required class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
          <label class="text-sm font-semibold">Stop Name<input name="stopName" required class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
          <label class="text-sm font-semibold">Address<input name="address" required class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
          <button ${canPlanRoute ? "" : "disabled"} class="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400 sm:col-span-2"><i data-lucide="Route" class="h-4 w-4"></i>Add Route Stop</button>
        </form>
        ${canPlanRoute ? "" : `<p class="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">Add technician users before planning routes.</p>`}
        <div class="mt-5 space-y-3">
          ${routeStops.length
            ? routeStops
                .map(
                  (stop, index) => `
                  <article class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <div class="flex items-start justify-between gap-3">
                      <div><p class="text-sm font-bold text-brand-600">Stop ${index + 1} · ${stop.eta}</p><h4 class="font-extrabold">${stop.stopName}</h4></div>
                      <span class="status-pill status-scheduled">${stop.status}</span>
                    </div>
                    <p class="mt-2 text-sm text-slate-500">${stop.technician} · ${stop.address}</p>
                  </article>`,
                )
                .join("")
            : emptyState("Route", "No route stops yet", "Planned visits will appear here in dispatch order.")}
        </div>
      </div>
    </section>
  `;
}

function inventoryView() {
  const query = state.inventorySearch.toLowerCase();
  const filtered = inventoryItems.filter((item) =>
    [item.name, item.sku, item.category, item.supplier].some((value) => String(value).toLowerCase().includes(query)),
  );
  return `
    <section class="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
      <form class="glass-panel rounded-lg p-5" onsubmit="addInventoryItem(event)">
        <h3 class="text-lg font-bold">Add Inventory Item</h3>
        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <label class="text-sm font-semibold">Material Name<input name="name" required class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
          <label class="text-sm font-semibold">SKU<input name="sku" class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
          <label class="text-sm font-semibold">Category<select name="category" class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"><option>Plumbing</option><option>Electrical</option><option>Tools</option><option>Consumables</option></select></label>
          <label class="text-sm font-semibold">Supplier<input name="supplier" class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
          <label class="text-sm font-semibold">Quantity<input name="quantity" type="number" min="0" required class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
          <label class="text-sm font-semibold">Reorder Level<input name="reorderLevel" type="number" min="0" required class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
          <label class="text-sm font-semibold">Unit Cost<input name="unitCost" type="number" min="0" required class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
        </div>
        <button class="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 font-bold text-white"><i data-lucide="Plus" class="h-4 w-4"></i>Add Item</button>
      </form>
      <div class="glass-panel rounded-lg p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h3 class="text-lg font-bold">Inventory</h3>
          <label class="relative min-w-64 flex-1 sm:flex-none">
            <i data-lucide="Search" class="absolute left-3 top-3 h-4 w-4 text-slate-400"></i>
            <input value="${state.inventorySearch}" oninput="state.inventorySearch=this.value; render();" placeholder="Search inventory" class="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 dark:border-slate-700 dark:bg-slate-900" />
          </label>
        </div>
        <div class="mt-5 space-y-3">
          ${filtered.length
            ? filtered
                .map(
                  (item) => `
                  <article class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                      <div><h4 class="font-extrabold">${item.name}</h4><p class="text-sm text-slate-500">${item.category} · ${item.sku || "No SKU"}</p></div>
                      <span class="status-pill ${item.quantity <= item.reorderLevel ? "status-overdue" : "status-completed"}">${item.quantity <= item.reorderLevel ? "Reorder" : "In Stock"}</span>
                    </div>
                    <div class="mt-3 grid gap-2 text-sm text-slate-500 sm:grid-cols-4">
                      <span>Qty: ${item.quantity}</span><span>Reorder: ${item.reorderLevel}</span><span>Cost: ${money(item.unitCost)}</span><span>${item.supplier || "No supplier"}</span>
                    </div>
                  </article>`,
                )
                .join("")
            : emptyState("Boxes", "No inventory items", "Materials, parts, and tools will appear here once added.")}
        </div>
      </div>
    </section>
  `;
}

function technicianView() {
  const firstTechnician = users.find((user) => user.role === "Technician");
  const techJobs = jobs.filter((job) => (firstTechnician ? job.technician === firstTechnician.name : false) || state.role !== "Technician");
  const selected = jobs.find((job) => job.number === state.selectedTechJob) || techJobs[0];
  if (!selected) {
    return `
      <section class="grid gap-6 xl:grid-cols-[390px_1fr]">
        <div class="mobile-shell mx-auto">
          <div class="bg-slate-950 px-5 py-4 text-white">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xs font-bold uppercase text-sky-300">Technician App</p>
                <h3 class="text-lg font-extrabold">Assigned Jobs</h3>
              </div>
              <i data-lucide="Signal" class="h-5 w-5"></i>
            </div>
          </div>
          <div class="p-4">${emptyState("Smartphone", "No assigned jobs", "Technician jobs will appear here after dispatch.")}</div>
        </div>
        <div class="space-y-5">
          ${technicianForm()}
          <div class="glass-panel rounded-lg p-5">${emptyState("ClipboardSignature", "No job selected", "Customer sign-off becomes available when a technician opens an assigned job.")}</div>
        </div>
      </section>
    `;
  }
  state.selectedTechJob = selected.number;
  return `
    <section class="grid gap-6 xl:grid-cols-[390px_1fr]">
      <div class="mobile-shell mx-auto">
        <div class="bg-slate-950 px-5 py-4 text-white">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs font-bold uppercase text-sky-300">Technician App</p>
              <h3 class="text-lg font-extrabold">Assigned Jobs</h3>
            </div>
            <i data-lucide="Signal" class="h-5 w-5"></i>
          </div>
        </div>
        <div class="max-h-[740px] overflow-y-auto p-4 scrollbar-thin">
          <div class="space-y-3">
            ${techJobs
              .map(
                (job) => `
                <button class="w-full rounded-lg border p-3 text-left ${selected.number === job.number ? "border-brand-600 bg-brand-50 dark:bg-slate-900" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"}" onclick="state.selectedTechJob='${job.number}'; render();">
                  <div class="flex justify-between gap-2"><strong>${job.number}</strong><span class="status-pill status-${slug(job.status)}">${job.status}</span></div>
                  <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">${customerById(job.customerId).company}</p>
                  <p class="text-xs text-slate-500">${job.address}</p>
                </button>`,
              )
              .join("")}
          </div>
          <div class="mt-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h4 class="font-extrabold">${selected.description}</h4>
            <div class="mt-3 grid grid-cols-3 gap-2">
              <button class="rounded-lg bg-emerald-600 px-2 py-2 text-sm font-bold text-white" onclick="updateJobStatus('${selected.number}', 'In Progress')">Start</button>
              <button class="rounded-lg bg-slate-700 px-2 py-2 text-sm font-bold text-white" onclick="updateJobStatus('${selected.number}', 'On Hold')">Pause</button>
              <button class="rounded-lg bg-brand-600 px-2 py-2 text-sm font-bold text-white" onclick="document.getElementById('signoff-form').scrollIntoView({behavior:'smooth'});">Finish</button>
            </div>
            <div class="mt-4">
              <p class="text-sm font-bold">Materials</p>
              ${selected.materials.map((item) => `<p class="text-sm text-slate-500">${item.quantity} x ${item.name} · ${money(item.cost)}</p>`).join("")}
              <p class="mt-1 text-sm font-bold">Total: ${money(materialTotal(selected))}</p>
            </div>
            <div class="mt-4">
              <p class="text-sm font-bold">Photos</p>
              <div class="mt-2 grid grid-cols-3 gap-2">
                ${["Before", "During", "After"].map((label) => `<div class="grid aspect-square place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-950">${label}</div>`).join("")}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="space-y-5">
        ${technicianForm()}
        <form id="signoff-form" class="glass-panel rounded-lg p-5" onsubmit="completeTechnicianJob(event)">
          <h3 class="text-lg font-bold">Customer Sign-off & Completion</h3>
          <p class="mt-1 text-sm text-slate-500">${selected.number} · ${customerById(selected.customerId).company}</p>
          <div class="mt-5 grid gap-4 lg:grid-cols-2">
            <label class="text-sm font-semibold">Before Photos<input type="file" multiple accept="image/*" class="mt-1 w-full rounded-lg border border-slate-200 p-3 dark:border-slate-700" /></label>
            <label class="text-sm font-semibold">After Photos<input type="file" multiple accept="image/*" class="mt-1 w-full rounded-lg border border-slate-200 p-3 dark:border-slate-700" /></label>
            <label class="text-sm font-semibold">Material Name<input name="materialName" class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
            <div class="grid grid-cols-2 gap-3">
              <label class="text-sm font-semibold">Quantity<input name="quantity" type="number" min="1" class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
              <label class="text-sm font-semibold">Cost<input name="cost" type="number" min="0" class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
            </div>
            <label class="lg:col-span-2 text-sm font-semibold">Work Notes<textarea name="completionNotes" required class="mt-1 min-h-24 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"></textarea></label>
            <label class="text-sm font-semibold">Customer Name<input name="customerName" required class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
            <div>
              <p class="text-sm font-semibold">Digital Signature</p>
              <canvas id="signatureCanvas" width="560" height="150" class="signature-pad mt-1 h-36 w-full rounded-lg border border-slate-200 dark:border-slate-700"></canvas>
            </div>
          </div>
          <button class="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 font-bold text-white"><i data-lucide="CheckCircle" class="h-4 w-4"></i>Complete Job</button>
        </form>
      </div>
    </section>
  `;
}

function technicianForm() {
  const technicians = users.filter((user) => user.role === "Technician");
  return `
    <section class="glass-panel rounded-lg p-5">
      <h3 class="text-lg font-bold">Add Technician</h3>
      <form class="mt-4 grid gap-3 sm:grid-cols-2" onsubmit="addTechnician(event)">
        <label class="text-sm font-semibold">Full Name<input name="name" required class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
        <label class="text-sm font-semibold">Phone<input name="phone" class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
        <label class="sm:col-span-2 text-sm font-semibold">Email<input name="email" type="email" class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
        <button class="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 font-bold text-white sm:col-span-2"><i data-lucide="UserPlus" class="h-4 w-4"></i>Add Technician</button>
      </form>
      <div class="mt-5 space-y-2">
        ${technicians.length
          ? technicians.map((tech) => `<div class="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900"><strong>${tech.name}</strong><span class="text-slate-500">${tech.phone || tech.email || "No contact"}</span></div>`).join("")
          : emptyState("UserRoundPlus", "No technicians yet", "Technicians added here can be assigned to jobs and routes.")}
      </div>
    </section>
  `;
}

function quotesView() {
  const canCreateQuote = customers.length > 0;
  const quoteRecords = quotes.map((quote) => ({
      id: quote.id,
      customer: customerById(quote.customerId).company,
      status: quote.status,
      rows: [
        ["Labour", money(quote.labour)],
        ["Materials", money(quote.materials)],
        ["VAT", money(quote.vat)],
        ["Total", money(quote.labour + quote.materials + quote.vat)],
      ],
      action: quote.status === "Approved" ? "Convert to Job" : "Send Quote",
    }));
  return `
    <section class="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
      <form class="glass-panel rounded-lg p-5" onsubmit="addQuote(event)">
        <h3 class="text-lg font-bold">Create Quotation</h3>
        ${canCreateQuote ? "" : `<p class="mt-2 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">Add a customer before creating quotations.</p>`}
        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          ${selectField("customer", "Customer", customers.map((customer) => [customer.id, `${customer.company} - ${customer.name}`]))}
          ${selectField("status", "Status", [["Draft", "Draft"], ["Sent", "Sent"], ["Approved", "Approved"], ["Rejected", "Rejected"]])}
          <label class="text-sm font-semibold">Labour<input name="labour" type="number" min="0" required class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
          <label class="text-sm font-semibold">Materials<input name="materials" type="number" min="0" required class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
          <label class="text-sm font-semibold">VAT<input name="vat" type="number" min="0" required class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
        </div>
        <button ${canCreateQuote ? "" : "disabled"} class="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400"><i data-lucide="Plus" class="h-4 w-4"></i>Create Quote</button>
      </form>
      ${recordsList("Quotes", quoteRecords)}
    </section>
  `;
}

function invoicesView() {
  const canCreateInvoice = customers.length > 0;
  const invoiceRecords = invoices.map((invoice) => ({
      id: invoice.id,
      customer: customerById(invoice.customerId).company,
      status: invoice.status,
      rows: [
        ["Job", invoice.jobNumber],
        ["Labour", money(invoice.labour)],
        ["Materials", money(invoice.materials)],
        ["VAT", money(invoice.vat)],
        ["Total", money(invoiceTotal(invoice))],
        ["Due", invoice.due || "No due date"],
      ],
      action: invoice.status === "Draft" ? "Send Invoice" : "View Invoice",
    }));
  return `
    <section class="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
      <form class="glass-panel rounded-lg p-5" onsubmit="addInvoice(event)">
        <h3 class="text-lg font-bold">Create Invoice</h3>
        ${canCreateInvoice ? "" : `<p class="mt-2 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">Add a customer before creating invoices.</p>`}
        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          ${selectField("customer", "Customer", customers.map((customer) => [customer.id, `${customer.company} - ${customer.name}`]))}
          ${selectField("status", "Status", [["Draft", "Draft"], ["Sent", "Sent"], ["Paid", "Paid"], ["Overdue", "Overdue"]])}
          <label class="text-sm font-semibold">Job Number<input name="jobNumber" placeholder="Optional" class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
          <label class="text-sm font-semibold">Due Date<input name="due" type="date" class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
          <label class="text-sm font-semibold">Labour<input name="labour" type="number" min="0" required class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
          <label class="text-sm font-semibold">Materials<input name="materials" type="number" min="0" required class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
          <label class="text-sm font-semibold">VAT<input name="vat" type="number" min="0" required class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
        </div>
        <button ${canCreateInvoice ? "" : "disabled"} class="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400"><i data-lucide="Plus" class="h-4 w-4"></i>Create Invoice</button>
      </form>
      ${recordsList("Invoices", invoiceRecords)}
    </section>
  `;
}

function recordsView(title, records, mapRecord) {
  if (!records.length) {
    return `
      <section class="glass-panel rounded-lg p-5">
        ${emptyState(title === "Quotes" ? "FileText" : "Receipt", `No ${title.toLowerCase()} yet`, `${title} will appear here once they are created.`)}
      </section>
    `;
  }
  return `
    <section class="grid gap-4 lg:grid-cols-3">
      ${records
        .map(mapRecord)
        .map(
          (record) => `
          <article class="glass-panel rounded-lg p-5">
            <div class="flex items-start justify-between gap-3">
              <div><p class="text-sm text-slate-500">${record.customer}</p><h3 class="text-xl font-extrabold">${record.id}</h3></div>
              <span class="status-pill status-${slug(record.status)}">${record.status}</span>
            </div>
            <dl class="mt-5 space-y-2">
              ${record.rows.map(([label, value]) => `<div class="flex justify-between gap-3 text-sm"><dt class="text-slate-500">${label}</dt><dd class="font-bold">${value}</dd></div>`).join("")}
            </dl>
            <button class="mt-5 w-full rounded-lg bg-brand-600 px-4 py-2.5 font-bold text-white">${record.action}</button>
          </article>`,
        )
        .join("")}
    </section>
  `;
}

function recordsList(title, records) {
  return `
    <div class="glass-panel rounded-lg p-5">
      <h3 class="text-lg font-bold">${title}</h3>
      <div class="mt-5 grid gap-4">
        ${records.length
          ? records
              .map(
                (record) => `
                <article class="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <div class="flex items-start justify-between gap-3">
                    <div><p class="text-sm text-slate-500">${record.customer}</p><h3 class="text-xl font-extrabold">${record.id}</h3></div>
                    <span class="status-pill status-${slug(record.status)}">${record.status}</span>
                  </div>
                  <dl class="mt-5 space-y-2">
                    ${record.rows.map(([label, value]) => `<div class="flex justify-between gap-3 text-sm"><dt class="text-slate-500">${label}</dt><dd class="font-bold">${value}</dd></div>`).join("")}
                  </dl>
                  <button class="mt-5 w-full rounded-lg bg-brand-600 px-4 py-2.5 font-bold text-white">${record.action}</button>
                </article>`,
              )
              .join("")
          : emptyState(title === "Quotes" ? "FileText" : "Receipt", `No ${title.toLowerCase()} yet`, `${title} will appear here once created.`)}
      </div>
    </div>
  `;
}

function analyticsView() {
  const reportCards = [
    ["Revenue", money(0), "Monthly revenue by completed and paid work"],
    ["Jobs Completed", 0, "Completed jobs across plumbing and electrical"],
    ["Average Completion", "0h", "Measured from start to customer sign-off"],
    ["Outstanding Invoices", money(0), "Sent and overdue invoices"],
    ["Top Customer", "None", "Highest recurring account this month"],
    ["Productivity", "0%", "Average technician productivity score"],
  ];
  return `
    <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      ${reportCards.map(([label, value, note]) => `<article class="metric-card"><p class="text-sm font-semibold text-slate-500">${label}</p><p class="mt-2 text-3xl font-extrabold">${value}</p><p class="mt-3 text-sm text-slate-500">${note}</p></article>`).join("")}
    </section>
    <section class="mt-5 glass-panel rounded-lg p-5">
      <h3 class="text-lg font-bold">Service Mix & Productivity</h3>
      <div class="mt-5 grid gap-5 lg:grid-cols-2">
        <div class="space-y-4">
          ${[["Plumbing", 0], ["Electrical", 0], ["Emergency", 0], ["Repeat customers", 0]].map(([label, value]) => `<div><div class="mb-1 flex justify-between text-sm font-semibold"><span>${label}</span><span>${value}%</span></div><div class="h-3 rounded-full bg-slate-200 dark:bg-slate-800"><div class="h-3 rounded-full bg-brand-600" style="width:${value}%"></div></div></div>`).join("")}
        </div>
        <div class="grid grid-cols-2 gap-3">
          ${users.filter((u) => u.role === "Technician").length ? users.filter((u) => u.role === "Technician").map((u) => `<div class="rounded-lg border border-slate-200 p-4 dark:border-slate-800"><p class="text-sm text-slate-500">${u.name}</p><p class="text-3xl font-extrabold">${u.performance || 0}%</p><p class="text-xs font-semibold text-emerald-600">On-time performance</p></div>`).join("") : emptyState("Users", "No technician analytics", "Productivity cards will appear after technician users and job activity exist.")}
        </div>
      </div>
    </section>
  `;
}

function whatsappView() {
  const enabledCount = [
    whatsappSettings.assignmentAlerts,
    whatsappSettings.statusAlerts,
    whatsappSettings.completionAlerts,
    whatsappSettings.invoiceAlerts,
  ].filter(Boolean).length;
  return `
    <section class="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
      <form class="glass-panel rounded-lg p-5" onsubmit="saveWhatsappSettings(event)">
        <h3 class="text-lg font-bold">WhatsApp Alert Settings</h3>
        <p class="mt-1 text-sm text-slate-500">Configure the alert events and business number that will be used by a future WhatsApp Business API connection.</p>
        <div class="mt-5 grid gap-4 sm:grid-cols-2">
          <label class="text-sm font-semibold">Provider<select name="provider" class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            ${["", "Meta WhatsApp Cloud API", "Twilio WhatsApp", "360dialog"].map((provider) => `<option value="${provider}" ${whatsappSettings.provider === provider ? "selected" : ""}>${provider || "Select provider"}</option>`).join("")}
          </select></label>
          <label class="text-sm font-semibold">Business Number<input name="businessNumber" value="${whatsappSettings.businessNumber}" placeholder="+27..." class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
        </div>
        <div class="mt-5 grid gap-3 sm:grid-cols-2">
          ${whatsappToggle("assignmentAlerts", "New job assignments", whatsappSettings.assignmentAlerts)}
          ${whatsappToggle("statusAlerts", "Status changes", whatsappSettings.statusAlerts)}
          ${whatsappToggle("completionAlerts", "Completed jobs", whatsappSettings.completionAlerts)}
          ${whatsappToggle("invoiceAlerts", "Overdue invoices", whatsappSettings.invoiceAlerts)}
        </div>
        <button class="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 font-bold text-white"><i data-lucide="Save" class="h-4 w-4"></i>Save Settings</button>
      </form>
      <div class="glass-panel rounded-lg p-5">
        <h3 class="text-lg font-bold">Alert Pipeline</h3>
        <div class="mt-5 grid gap-3">
          ${[
            ["MessageCircle", "Template mapping", "Each event type maps to an approved WhatsApp template."],
            ["ShieldCheck", "Consent checks", "Customer opt-in status can be checked before sending."],
            ["Send", "Delivery queue", "Messages can be queued, retried, and audited."],
            ["FileClock", "Audit history", "Every outbound message can be linked back to jobs, invoices, and users."],
          ]
            .map(
              ([icon, title, copy]) => `
              <article class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div class="flex gap-3">
                  <span class="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-slate-800"><i data-lucide="${icon}" class="h-5 w-5"></i></span>
                  <div><h4 class="font-extrabold">${title}</h4><p class="text-sm text-slate-500">${copy}</p></div>
                </div>
              </article>`,
            )
            .join("")}
        </div>
        <p class="mt-4 rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">${enabledCount} alert types enabled.</p>
      </div>
    </section>
  `;
}

function companiesView() {
  const query = state.companySearch.toLowerCase();
  const filtered = companies.filter((company) =>
    [company.name, company.email, company.vatNumber, company.billingPlan].some((value) => String(value).toLowerCase().includes(query)),
  );
  return `
    <section class="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
      <form class="glass-panel rounded-lg p-5" onsubmit="addCompany(event)">
        <h3 class="text-lg font-bold">Add Company</h3>
        <p class="mt-1 text-sm text-slate-500">Supports multi-company operations and subscription billing records.</p>
        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <label class="text-sm font-semibold">Company Name<input name="name" required class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
          <label class="text-sm font-semibold">VAT Number<input name="vatNumber" class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
          <label class="text-sm font-semibold">Phone<input name="phone" class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
          <label class="text-sm font-semibold">Email<input name="email" type="email" class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
          <label class="sm:col-span-2 text-sm font-semibold">Address<input name="address" class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
          <label class="text-sm font-semibold">Billing Plan<select name="billingPlan" class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"><option>Starter</option><option>Professional</option><option>Enterprise</option></select></label>
        </div>
        <button class="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 font-bold text-white"><i data-lucide="Plus" class="h-4 w-4"></i>Add Company</button>
      </form>
      <div class="glass-panel rounded-lg p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h3 class="text-lg font-bold">Companies & Subscriptions</h3>
          <label class="relative min-w-64 flex-1 sm:flex-none">
            <i data-lucide="Search" class="absolute left-3 top-3 h-4 w-4 text-slate-400"></i>
            <input value="${state.companySearch}" oninput="state.companySearch=this.value; render();" placeholder="Search companies" class="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 dark:border-slate-700 dark:bg-slate-900" />
          </label>
        </div>
        <div class="mt-5 space-y-3">
          ${filtered.length
            ? filtered
                .map(
                  (company) => `
                  <article class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                      <div><h4 class="font-extrabold">${company.name}</h4><p class="text-sm text-slate-500">${company.email || "No billing email"} · ${company.phone || "No phone"}</p></div>
                      <span class="status-pill status-completed">${company.billingStatus}</span>
                    </div>
                    <div class="mt-3 grid gap-2 text-sm text-slate-500 sm:grid-cols-3">
                      <span>Plan: ${company.billingPlan}</span><span>VAT: ${company.vatNumber || "Not set"}</span><span>${company.address || "No address"}</span>
                    </div>
                  </article>`,
                )
                .join("")
            : emptyState("Building2", "No companies yet", "Company tenants and subscription billing records will appear here.")}
        </div>
      </div>
    </section>
  `;
}

function notificationsView() {
  return `
    <section class="mx-auto max-w-3xl glass-panel rounded-lg p-5">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-bold">Notification Center</h3>
        <button class="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold dark:border-slate-700" onclick="notifications=notifications.map(n=>({...n, unread:false})); render();">Mark all read</button>
      </div>
      <div class="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
        ${notifications.length
          ? notifications
          .map(
            (item) => `
            <article class="flex gap-3 py-4 ${item.unread ? "font-bold" : ""}">
              <span class="grid h-10 w-10 shrink-0 place-items-center rounded-lg ${item.unread ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-900"}"><i data-lucide="${notificationIcon(item.type)}" class="h-4 w-4"></i></span>
              <div><p>${item.text}</p><p class="text-sm font-normal text-slate-500">${item.time}</p></div>
            </article>`,
          )
          .join("")
          : emptyState("Bell", "No notifications", "Assignment, status, completion, and invoice alerts will appear here.")}
      </div>
    </section>
  `;
}

function whatsappToggle(name, label, checked) {
  return `
    <label class="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm font-semibold dark:border-slate-800 dark:bg-slate-900">
      <span>${label}</span>
      <input name="${name}" type="checkbox" ${checked ? "checked" : ""} class="h-5 w-5 accent-blue-600" />
    </label>
  `;
}

function selectField(name, label, options) {
  return `
    <label class="text-sm font-semibold">${label}
      <select name="${name}" class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
        ${options.length ? options.map(([value, text]) => `<option value="${value}">${text}</option>`).join("") : `<option value="">No options available</option>`}
      </select>
    </label>
  `;
}

function notificationIcon(type) {
  return {
    assignment: "UserPlus",
    status: "RefreshCw",
    complete: "BadgeCheck",
    invoice: "Receipt",
    whatsapp: "MessageCircle",
  }[type] || "Bell";
}

function bindSignaturePad() {
  const canvas = document.getElementById("signatureCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let drawing = false;
  const rectPoint = (event) => {
    const rect = canvas.getBoundingClientRect();
    const point = event.touches ? event.touches[0] : event;
    return {
      x: ((point.clientX - rect.left) / rect.width) * canvas.width,
      y: ((point.clientY - rect.top) / rect.height) * canvas.height,
    };
  };
  const start = (event) => {
    drawing = true;
    const { x, y } = rectPoint(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (event) => {
    if (!drawing) return;
    event.preventDefault();
    const { x, y } = rectPoint(event);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = state.dark ? "#e2e8f0" : "#0f172a";
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const stop = () => {
    drawing = false;
  };
  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", move);
  canvas.addEventListener("mouseup", stop);
  canvas.addEventListener("mouseleave", stop);
  canvas.addEventListener("touchstart", start);
  canvas.addEventListener("touchmove", move);
  canvas.addEventListener("touchend", stop);
}

function render() {
  const views = {
    dashboard: dashboardView,
    jobs: jobsView,
    customers: customersView,
    dispatch: dispatchView,
    inventory: inventoryView,
    technician: technicianView,
    quotes: quotesView,
    invoices: invoicesView,
    analytics: analyticsView,
    whatsapp: whatsappView,
    companies: companiesView,
    notifications: notificationsView,
  };
  document.getElementById("app").innerHTML = layout(views[state.view]());
  if (window.lucide) window.lucide.createIcons();
  bindSignaturePad();
}

loadData();
