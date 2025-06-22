import { ZuploContext, ZuploRequest } from "@zuplo/runtime";
import { BodyEnricher } from "./utils/body-enricher";
import { CourseService } from "./utils/course-service";
import { UserService } from "./utils/user-service";

interface PolicyOptions {
    enabled?: boolean;
    enableUserEnrichment?: boolean;
    enableCourseEnrichment?: boolean;
    forwardAuthToken?: boolean;
}

export default async function ResponseEnrichmentPolicy(
    response: Response,
    request: ZuploRequest,
    context: ZuploContext,
    options: PolicyOptions,
    policyName: string
): Promise<Response> {
    // Skip enrichment if disabled
    if (options.enabled === false) {
        context.log.debug("Response enrichment is disabled");
        return response;
    }

    // Only process successful JSON responses
    if (!response.ok) {
        context.log.debug("Skipping enrichment for non-successful response");
        return response;
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
        context.log.debug("Skipping enrichment for non-JSON response");
        return response;
    }

    try {
        // Extract authorization token from original request
        let authToken: string | undefined;
        if (options.forwardAuthToken !== false) {
            const authHeader = request.headers.get("Authorization");
            if (authHeader) {
                authToken = authHeader;
                context.log.debug("Extracted Authorization token from original request");
            } else {
                context.log.debug("No Authorization header found in original request");
            }
        }

        // Clone the response to read the body
        const responseClone = response.clone();
        let responseBody;

        try {
            responseBody = await responseClone.json();
        } catch (error) {
            context.log.warn("Failed to parse response body as JSON", error);
            return response;
        }

        // Extract all IDs from the response body
        const extractedIds = BodyEnricher.extractIds(responseBody);

        context.log.info(`Extracted ${extractedIds.userIds.size} user IDs and ${extractedIds.courseIds.size} course IDs`);

        // Skip enrichment if no IDs found
        if (extractedIds.userIds.size === 0 && extractedIds.courseIds.size === 0) {
            context.log.debug("No IDs found for enrichment");
            return response;
        }

        // Fetch user and course data in parallel
        const promises: Promise<any>[] = [];

        let userMap = new Map<string, string>();
        let courseMap = new Map<string, string>();

        if (options.enableUserEnrichment !== false && extractedIds.userIds.size > 0) {
            promises.push(
                UserService.getBatchUsers(Array.from(extractedIds.userIds), context, authToken)
                    .then(map => {
                        userMap = map;
                    })
            );
        }

        if (options.enableCourseEnrichment !== false && extractedIds.courseIds.size > 0) {
            promises.push(
                CourseService.getBatchCourses(Array.from(extractedIds.courseIds), context)
                    .then(map => { courseMap = map; })
            );
        }

        // Wait for all external service calls to complete
        await Promise.all(promises);

        context.log.info(`Fetched ${userMap.size} user names and ${courseMap.size} course titles`);

        // Skip enrichment if no data was fetched
        if (userMap.size === 0 && courseMap.size === 0) {
            context.log.debug("No enrichment data fetched");
            return response;
        }

        // Enrich the response body
        const enrichedBody = await BodyEnricher.enrichResponseBody(
            responseBody,
            userMap,
            courseMap,
            context
        );

        // Create new response with enriched body
        const enrichedResponse = new Response(
            JSON.stringify(enrichedBody),
            {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
            }
        );

        context.log.info("Response enrichment completed successfully");
        return enrichedResponse;

    } catch (error) {
        context.log.error("Error during response enrichment", error);
        // Return original response on error to avoid breaking the API
        return response;
    }
} 