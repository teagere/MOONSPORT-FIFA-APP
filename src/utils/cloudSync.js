const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const APP_STATE_ID = "main";

function getSupabaseRestUrl() {
  return SUPABASE_URL.replace(/\/$/, "");
}

function getHeaders(extraHeaders = {}) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    ...extraHeaders,
  };
}

export function isCloudSyncConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export async function fetchCloudState() {
  if (!isCloudSyncConfigured()) return null;

  const response = await fetch(`${getSupabaseRestUrl()}/rest/v1/app_state?id=eq.${APP_STATE_ID}&select=data`, {
    headers: getHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Could not load Supabase app data: ${response.status} ${await response.text()}`);
  }

  const rows = await response.json();
  return rows?.[0]?.data || null;
}

export async function saveCloudState(state) {
  if (!isCloudSyncConfigured()) return;

  const response = await fetch(`${getSupabaseRestUrl()}/rest/v1/app_state?on_conflict=id`, {
    method: "POST",
    headers: getHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify({
      id: APP_STATE_ID,
      data: state,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Could not save Supabase app data: ${response.status} ${await response.text()}`);
  }
}
