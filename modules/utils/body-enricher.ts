import { ZuploContext } from "@zuplo/runtime";

// Define the field mappings
export const USER_FIELD_MAPPINGS = {
    // Single user ID fields
    teacher_id: 'teacher_name',
    teacher_uuid: 'teacher_name',
    aux_teacher_id: 'aux_teacher_name',
    student_id: 'student_name',
    student_uuid: 'student_name',
    author_id: 'author_name',

    // Array user ID fields
    teacher_ids: 'teacher_names',
    aux_teacher_ids: 'aux_teacher_names',
    students_ids: 'student_names'
} as const;

export const COURSE_FIELD_MAPPINGS = {
    course_id: 'course_title'
} as const;

export interface ExtractedIds {
    userIds: Set<string>;
    courseIds: Set<string>;
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
     * Recursively inject names into a data structure
     */
    static injectNames(
        data: any,
        userMap: Map<string, string>,
        courseMap: Map<string, string>,
        context: ZuploContext
    ): any {
        if (!data || typeof data !== 'object') {
            return data;
        }

        if (Array.isArray(data)) {
            // If it's an array, process each element
            return data.map(item => this.injectNames(item, userMap, courseMap, context));
        }

        // Create a copy of the object to avoid mutating the original
        const result = { ...data };

        // Process each key in the object
        Object.keys(result).forEach(key => {
            const value = result[key];

            // Handle single user ID fields
            if (key in USER_FIELD_MAPPINGS && value && typeof value === 'string') {
                const nameField = USER_FIELD_MAPPINGS[key as keyof typeof USER_FIELD_MAPPINGS];
                const userName = userMap.get(value);
                if (userName) {
                    result[nameField] = userName;
                    context.log.debug(`Injected ${nameField}: ${userName} for ${key}: ${value}`);
                }
            }

            // Handle array user ID fields
            else if (key in USER_FIELD_MAPPINGS && Array.isArray(value)) {
                const nameField = USER_FIELD_MAPPINGS[key as keyof typeof USER_FIELD_MAPPINGS];
                const names: string[] = [];
                value.forEach(id => {
                    if (id && typeof id === 'string') {
                        const userName = userMap.get(id);
                        if (userName) {
                            names.push(userName);
                        }
                    }
                });
                if (names.length > 0) {
                    result[nameField] = names;
                    context.log.debug(`Injected ${nameField}: [${names.join(', ')}] for ${key}`);
                }
            }

            // Handle course ID fields
            else if (key in COURSE_FIELD_MAPPINGS && value && typeof value === 'string') {
                const titleField = COURSE_FIELD_MAPPINGS[key as keyof typeof COURSE_FIELD_MAPPINGS];
                const courseTitle = courseMap.get(value);
                if (courseTitle) {
                    result[titleField] = courseTitle;
                    context.log.debug(`Injected ${titleField}: ${courseTitle} for ${key}: ${value}`);
                }
            }

            // Recursively process nested objects and arrays
            else if (typeof value === 'object') {
                result[key] = this.injectNames(value, userMap, courseMap, context);
            }
        });

        return result;
    }

    /**
     * Main enrichment function that combines extraction and injection
     */
    static async enrichResponseBody(
        responseBody: any,
        userMap: Map<string, string>,
        courseMap: Map<string, string>,
        context: ZuploContext
    ): Promise<any> {
        context.log.info("Starting response body enrichment");

        const enrichedBody = this.injectNames(responseBody, userMap, courseMap, context);

        context.log.info("Response body enrichment completed");
        return enrichedBody;
    }
} 