import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://wovjmrzsathydotnvssi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_0r55W2woMSdPDZ9oXHLXIw_-38qIbvO";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
