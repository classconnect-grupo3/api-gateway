import { ZuploContext } from "@zuplo/runtime";
import { EnrichedUserData } from "./user-service";

// Define the user ID fields that we should extract from
export const USER_FIELD_MAPPINGS = {
    // Single user ID fields
    teacher_id: true,
    teacher_uuid: true,
    aux_teacher_id: true,
    student_id: true,
    student_uuid: true,
    author_id: true,

    // Array user ID fields
    teacher_ids: true,
    aux_teacher_ids: true,
    students_ids: true
} as const;

export const COURSE_FIELD_MAPPINGS = {
    course_id: 'course_title'
} as const;

export interface ExtractedIds {
    userIds: Set<string>;
    courseIds: Set<string>;
}

export interface UserInfo {
    uid: string;
    name: string;
    email: string;
}

export class BodyEnricher {

    /**
     * Recursively extract all user and course IDs from a data structure
     */
    static extractIds(data: any, extractedIds: ExtractedIds = { userIds: new Set(), courseIds: new Set() }): ExtractedIds {
        if (!data || typeof data !== 'object') {
            return extractedIds;
        }

        if (Array.isArray(data)) {
            // If it's an array, process each element
            data.forEach(item => this.extractIds(item, extractedIds));
            return extractedIds;
        }

        // Process each key in the object
        Object.keys(data).forEach(key => {
            const value = data[key];

            // Check for single user ID fields
            if (key in USER_FIELD_MAPPINGS && value && typeof value === 'string') {
                extractedIds.userIds.add(value);
            }

            // Check for array user ID fields
            else if (key in USER_FIELD_MAPPINGS && Array.isArray(value)) {
                value.forEach(id => {
                    if (id && typeof id === 'string') {
                        extractedIds.userIds.add(id);
                    }
                });
            }

            // Check for course ID fields
            else if (key in COURSE_FIELD_MAPPINGS && value && typeof value === 'string') {
                extractedIds.courseIds.add(value);
            }

            // Recursively process nested objects and arrays
            else if (typeof value === 'object') {
                this.extractIds(value, extractedIds);
            }
        });

        return extractedIds;
    }

    /**
     * Recursively inject user info array and course titles into a data structure
     */
    static injectUserInfoAndCourses(
        data: any,
        userMap: Map<string, EnrichedUserData>,
        courseMap: Map<string, string>,
        context: ZuploContext
    ): any {
        if (!data || typeof data !== 'object') {
            return data;
        }

        if (Array.isArray(data)) {
            // If it's an array, process each element
            return data.map(item => this.injectUserInfoAndCourses(item, userMap, courseMap, context));
        }

        // Create a copy of the object to avoid mutating the original
        const result = { ...data };

        // Process each key in the object
        Object.keys(result).forEach(key => {
            const value = result[key];

            // Handle course ID fields
            if (key in COURSE_FIELD_MAPPINGS && value && typeof value === 'string') {
                const titleField = COURSE_FIELD_MAPPINGS[key as keyof typeof COURSE_FIELD_MAPPINGS];
                const courseTitle = courseMap.get(value);
                if (courseTitle) {
                    result[titleField] = courseTitle;
                    context.log.debug(`Injected ${titleField}: ${courseTitle} for ${key}: ${value}`);
                }
            }

            // Recursively process nested objects and arrays
            else if (typeof value === 'object') {
                result[key] = this.injectUserInfoAndCourses(value, userMap, courseMap, context);
            }
        });

        return result;
    }

    /**
     * Create user_info array from the user map
     */
    static createUserInfoArray(
        userMap: Map<string, EnrichedUserData>,
        context: ZuploContext
    ): UserInfo[] {
        const userInfoArray: UserInfo[] = [];

        userMap.forEach((userData, userId) => {
            userInfoArray.push({
                uid: userId,
                name: userData.name,
                email: userData.email
            });
        });

        context.log.info(`Created user_info array with ${userInfoArray.length} users`);
        return userInfoArray;
    }

    /**
     * Main enrichment function that combines extraction and injection
     */
    static async enrichResponseBody(
        responseBody: any,
        userMap: Map<string, EnrichedUserData>,
        courseMap: Map<string, string>,
        context: ZuploContext
    ): Promise<any> {
        context.log.info("Starting response body enrichment");

        // First, inject course titles and process the structure
        const enrichedBody = this.injectUserInfoAndCourses(responseBody, userMap, courseMap, context);
        if (!enrichedBody) {
          context.log.info("Could not enrich body, returning original body instead")
          return responseBody;
        }

        // Then, add the user_info array at the root level if we have user data
        if (userMap.size > 0) {
            enrichedBody.user_info = this.createUserInfoArray(userMap, context);
        }

        context.log.info("Response body enrichment completed");
        return enrichedBody;
    }
} 