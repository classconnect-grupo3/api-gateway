import { ZuploContext, ZuploRequest } from "@zuplo/runtime";
import admin from "firebase-admin";

// Initialize Firebase Admin SDK (only once)
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
    });
}

interface UserResponse {
    id: string;
    is_blocked: boolean;
    // Add other user fields as needed
}

interface PolicyOptions {
    allowUnauthenticatedRequests?: boolean;
}

interface CustomUser {
    sub: string;
    data: {
        firebaseUid: string;
        is_blocked: boolean;
        userData: UserResponse;
    };
}

export default async function FirebaseAuthWithBlockingPolicy(
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
                // Allow request to continue without authentication
                return request;
            }

            context.log.warn("Missing or invalid Authorization header");
            return new Response(
                JSON.stringify({ error: "Authorization header is required" }),
                { status: 401, headers: { "Content-Type": "application/json" } }
            );
        }

        // Extract the token
        const token = authHeader.substring(7); // Remove "Bearer " prefix

        // Verify the Firebase token
        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(token);
            context.log.info(`Token verified for user: ${decodedToken.uid}`);
        } catch (error) {
            context.log.error("Token verification failed", error);
            return new Response(
                JSON.stringify({ error: "Invalid token" }),
                { status: 401, headers: { "Content-Type": "application/json" } }
            );
        }

        // Extract user ID from the decoded token
        const userId = decodedToken.uid;

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

        // Create a user object for downstream handlers
        const user: CustomUser = {
            sub: userId,
            data: {
                firebaseUid: userId,
                is_blocked: userResponse.is_blocked,
                userData: userResponse
            }
        };

        // Add user to request context for downstream handlers
        (request as any).user = user;

        context.log.info(`Access granted for user: ${userId}`);

        // Allow request to continue to the next policy or handler
        return request;

    } catch (error) {
        context.log.error("Unexpected error in authentication policy", error);
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
} 