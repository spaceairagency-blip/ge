// ------------------------------------------------------------------
// Fill these in with your own Supabase project values.
// Project Settings > API > Project URL / anon public key.
// The anon key is safe to expose in frontend code — it only has the
// permissions your Row Level Security policies grant it.
// ------------------------------------------------------------------
const SUPABASE_URL = "https://tctackfgwnrnaizrvupn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjdGFja2Znd25ybmFpenJ2dXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMjg0NDQsImV4cCI6MjA5OTcwNDQ0NH0.M12FwIv1dlB7K3ICozRrr5wLYzVQmb6n3M7vYEc0Dow";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
