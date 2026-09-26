import { createClient } from "npm:@supabase/supabase-js@2";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function generatePassword(): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const { email, full_name, phone } = await req.json();

    if (!email || !full_name) {
      return json({ error: "email and full_name are required" }, 400);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Check if user already exists (tenant self-signed up via Auth page)
    const { data: existing } = await admin.auth.admin.listUsers({
      filter: `email = "${email}"`,
    });

    const existingUser = existing?.users?.[0];
    if (existingUser) {
      return json({ userId: existingUser.id, existing: true, tempPassword: null }, 200);
    }

    const tempPassword = generatePassword();

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        role: "tenant",
        full_name,
        phone: phone ?? "",
      },
    });

    if (error) {
      return json({ error: error.message }, 400);
    }

    return json({ userId: data.user.id, existing: false, tempPassword }, 200);
  } catch {
    return json({ error: "Bad request" }, 400);
  }
});
