import { ZuploContext } from "@zuplo/runtime";

interface UserBatchRequest {
    user_ids: string[];
}

interface UserData {
    uid: string;
    name: string;
    surname: string;
    email: string;
    // Add other user fields as needed
}

interface UserBatchResponse {
    data: Array<UserData>;
}

export interface EnrichedUserData {
    name: string;
    email: string;
}

export class UserService {
    private static readonly BASE_URL = "https://users-service-production-968d.up.railway.app";

    static async getBatchUsers(
        userIds: string[],
        context: ZuploContext,
        authToken?: string
    ): Promise<Map<string, EnrichedUserData>> {
        if (userIds.length === 0) {
            return new Map();
        }

        try {
            const requestBody: UserBatchRequest = {
                user_ids: userIds
            };

            context.log.info(`Fetching batch users for IDs: ${userIds.join(', ')}`);

            // Prepare headers
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };

            // Add authorization header if token is provided
            if (authToken) {
                headers['Authorization'] = authToken;
                context.log.debug("Added Authorization header to user service request");
            }

            const response = await fetch(`${this.BASE_URL}/users/batch`, {
                method: 'POST',
                headers,
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                context.log.error(`User service returned ${response.status}: ${response.statusText}`);
                return new Map(); // Return empty map on error, don't fail the whole request
            }

            const data: UserBatchResponse = await response.json();

            // Create a map of user ID to user data (name and email)
            const userMap = new Map<string, EnrichedUserData>();
            data.data.forEach(user => {
                userMap.set(user.uid, {
                    name: user.name + ' ' + user.surname,
                    email: user.email
                });
            });

            context.log.info(`Successfully fetched ${userMap.size} user records with names and emails`);
            return userMap;

        } catch (error) {
            context.log.error("Failed to fetch batch users", error);
            return new Map(); // Return empty map on error, don't fail the whole request
        }
    }
} 