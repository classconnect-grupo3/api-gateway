import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

type CheckUserIsAdminOptions = {
  usersServiceBaseUrl: string;
};

export default async function policy(
  request: ZuploRequest,
  context: ZuploContext,
  options: CheckUserIsAdminOptions,
  policyName: string
) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    context.log.warn("Missing Authorization header");
    return new Response(JSON.stringify({ error: "Missing token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const token = authHeader.substring(7);

  let decoded;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("Invalid token format");
    const payload = JSON.parse(atob(parts[1]));
    decoded = payload;
  } catch (e) {
    context.log.error("Invalid token format", e);
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const uid = decoded.sub;
  if (!uid) {
    return new Response(JSON.stringify({ error: "UID not found in token" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let bodyText: string;
  let body: any;
  try {
    bodyText = await request.text();
    body = JSON.parse(bodyText);
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const emailToBlock = body.email;
  if (!emailToBlock) {
    return new Response(JSON.stringify({ error: "Email is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const url = `${options.usersServiceBaseUrl}/users/${uid}/is-admin`;
    const response = await fetch(url);
    if (!response.ok) {
      context.log.error(`Failed to verify admin status: ${response.status}`);
      return new Response(
        JSON.stringify({ error: "Error checking admin status" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    if (!data.is_admin) {
      context.log.warn(`User ${uid} is not admin`);
      return new Response(
        JSON.stringify({
          error: "Forbidden",
          message: "You must be an admin to access this resource.",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    if (data.email === emailToBlock) {
      context.log.warn(`Admin user ${uid} tried to block themselves`);
      return new Response(
        JSON.stringify({
          error: "Operation not allowed",
          message: "Admins cannot block their own account.",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // ✅ Admin AND not blocking themselves → allow
    return new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body: bodyText, // restore body
    });
  } catch (e) {
    context.log.error("Unexpected error in admin check", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
