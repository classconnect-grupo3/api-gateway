import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

type CheckUserIsActiveOptions = {
  usersServiceBaseUrl: string; // Ej: "https://users-service-production-968d.up.railway.app"
};

export default async function policy(
  request: ZuploRequest,
  context: ZuploContext,
  options: CheckUserIsActiveOptions,
  policyName: string
) {
  // Aplicar solo a login con email
  if (request.method !== "POST" || !request.url.includes("/login/email")) {
    return request;
  }

  let body_txt: any;
  let body: any;
  try {
    body_txt = await request.text();
    body = JSON.parse(body_txt);

  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const email = body.email;
  if (!email) {
    return new Response(JSON.stringify({ error: "Email is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const url = `${options.usersServiceBaseUrl}/users/${email}/is-active`;
    const response = await fetch(url);
    if (!response.ok) {
      context.log.error(`Error from user service: ${response.status}`);
      return new Response(JSON.stringify({ error: "Could not verify account status" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const json = await response.json();
    if (!json.is_active) {
      context.log.warn(`Blocked inactive user: ${email}`);
      return new Response(
        JSON.stringify({
          error: "Account not active",
          message: "Please verify your phone number before logging in.",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Usuario activo → permitir request
    const newRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: body_txt, // volvés a usar el mismo body
    });

  return newRequest;
  } catch (error) {
    context.log.error("Unexpected error in is-active policy", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

