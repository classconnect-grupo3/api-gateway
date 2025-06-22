import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

export default async function (request: ZuploRequest, context: ZuploContext) {
    // The user information is available thanks to the firebase-auth-with-blocking policy
    const user = (request as any).user;

    if (!user) {
        context.log.error("User not found in request context - policy may not be applied");
        return new Response(
            JSON.stringify({ error: "Authentication required" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        );
    }

    context.log.info(`Protected endpoint accessed by user: ${user.sub}`);

    // Example: Return user information and some protected data
    return new Response(
        JSON.stringify({
            message: "Welcome to the protected endpoint!",
            user: {
                id: user.sub,
                is_blocked: user.data.is_blocked,
                timestamp: new Date().toISOString()
            },
            protectedData: {
                secret: "This is only visible to authenticated, non-blocked users",
                accessLevel: "standard"
            }
        }),
        {
            status: 200,
            headers: { "Content-Type": "application/json" }
        }
    );
} 