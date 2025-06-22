import { ZuploContext } from "@zuplo/runtime";

interface CourseResponse {
    id: string;
    title: string;
    // Add other course fields as needed
}

export class CourseService {
    private static readonly BASE_URL = "https://courses-service-production.up.railway.app";

    static async getCourse(courseId: string, context: ZuploContext): Promise<string | null> {
        if (!courseId) {
            return null;
        }

        try {
            context.log.info(`Fetching course for ID: ${courseId}`);

            const response = await fetch(`${this.BASE_URL}/courses/${courseId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                context.log.error(`Course service returned ${response.status}: ${response.statusText}`);
                return null; // Return null on error, don't fail the whole request
            }

            const data: CourseResponse = await response.json();

            context.log.info(`Successfully fetched course title: ${data.title}`);
            return data.title;

        } catch (error) {
            context.log.error(`Failed to fetch course ${courseId}`, error);
            return null; // Return null on error, don't fail the whole request
        }
    }

    static async getBatchCourses(courseIds: string[], context: ZuploContext): Promise<Map<string, string>> {
        if (courseIds.length === 0) {
            return new Map();
        }

        const courseMap = new Map<string, string>();

        // Since we don't have a batch endpoint, fetch courses individually
        // In a real scenario, you might want to implement parallel fetching with Promise.all
        const promises = courseIds.map(async (courseId) => {
            const title = await this.getCourse(courseId, context);
            if (title) {
                courseMap.set(courseId, title);
            }
        });

        await Promise.all(promises);

        return courseMap;
    }
} 