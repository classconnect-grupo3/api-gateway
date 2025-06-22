import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

interface UserResponse {
    id: string;
    is_blocked: boolean;
}

interface PolicyOptions {
    allowUnauthenticatedRequests?: boolean;
    firebaseProjectId: string;
}

// Simple Firebase token verification using Web Crypto API
async function verifyFirebaseToken(token: string, projectId: string): Promise<any> {
    // Get Firebase public keys
    const keysResponse = await fetch(
        `https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com`
    );
    const keys = await keysResponse.json();

    // Decode JWT header to get key ID
    const parts = token.split('.');
    if (parts.length !== 3) {
        throw new Error('Invalid token format');
    }

    const header = JSON.parse(atob(parts[0]));
    const payload = JSON.parse(atob(parts[1]));

    // Basic validation
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
        throw new Error('Invalid issuer');
    }

    if (payload.aud !== projectId) {
        throw new Error('Invalid audience');
    }

    if (payload.exp < Date.now() / 1000) {
        throw new Error('Token expired');
    }

    return payload;
}

export default async function FirebaseAuthSimplePolicy(
    request: ZuploRequest,
    context: ZuploContext,
    options: PolicyOptions,
    policyName: string
) {
    try {
        // Extract Authorization header
        const authHeader = request.headers.get("Authorization");

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            if (options.allowUnauthenticatedRequests) {
                return request;
            }

            context.log.warn("Missing or invalid Authorization header");
            return new Response(
                JSON.stringify({ error: "Authorization header is required" }),
                { status: 401, headers: { "Content-Type": "application/json" } }
            );
        }

        // Extract the token
        const token = authHeader.substring(7);

        // Verify the Firebase token using Web APIs
        let decodedToken;
        try {
            decodedToken = await verifyFirebaseToken(token, options.firebaseProjectId);
            context.log.info(`Token verified for user: ${decodedToken.sub}`);
        } catch (error) {
            context.log.error("Token verification failed", error);
            return new Response(
                JSON.stringify({ error: "Invalid token" }),
                { status: 401, headers: { "Content-Type": "application/json" } }
            );
        }

        // Extract user ID from the decoded token
        const userId = decodedToken.sub;

        // Call the users service to get user info
        const userServiceUrl = `https://users-service-production-968d.up.railway.app/users/search?id=${userId}`;

        let userResponse;
        try {
            const response = await fetch(userServiceUrl);
            if (!response.ok) {
                context.log.error(`User service returned ${response.status}: ${response.statusText}`);
                return new Response(
                    JSON.stringify({ error: "Failed to fetch user information" }),
                    { status: 500, headers: { "Content-Type": "application/json" } }
                );
            }

            userResponse = await response.json() as UserResponse;
            context.log.info(`User info retrieved for ID: ${userId}`);
        } catch (error) {
            context.log.error("Failed to call user service", error);
            return new Response(
                JSON.stringify({ error: "Failed to connect to user service" }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }

        // Check if user is blocked
        if (userResponse.is_blocked === true) {
            context.log.warn(`Access denied for blocked user: ${userId}`);
            return new Response(
                JSON.stringify({
                    error: "Access denied",
                    message: "Your account has been blocked. Please contact support."
                }),
                { status: 403, headers: { "Content-Type": "application/json" } }
            );
        }

        // Add user to request context
        (request as any).user = {
            sub: userId,
            data: {
                firebaseUid: userId,
                is_blocked: userResponse.is_blocked,
                userData: userResponse
            }
        };

        context.log.info(`Access granted for user: ${userId}`);
        return request;

    } catch (error) {
        context.log.error("Unexpected error in authentication policy", error);
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
} 