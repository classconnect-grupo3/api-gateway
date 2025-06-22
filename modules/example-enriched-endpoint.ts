import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

export default async function (request: ZuploRequest, context: ZuploContext) {
    // Example response that contains various user and course IDs
    // This data will be enriched by the response-enrichment outbound policy
    const exampleData = {
        message: "Example data with IDs that will be enriched",
        course: {
            course_id: "course-123",
            title: "This will be enriched with course_title",
            teacher_id: "user-teacher-456",
            aux_teacher_id: "user-aux-789",
            students_ids: ["user-student-001", "user-student-002", "user-student-003"]
        },
        posts: [
            {
                id: "post-1",
                author_id: "user-author-111",
                content: "First post content"
            },
            {
                id: "post-2",
                author_id: "user-author-222",
                content: "Second post content"
            }
        ],
        classroom: {
            teacher_uuid: "user-teacher-333",
            teacher_ids: ["user-teacher-444", "user-teacher-555"],
            aux_teacher_ids: ["user-aux-666", "user-aux-777"],
            assignments: [
                {
                    id: "assignment-1",
                    course_id: "course-456",
                    teacher_id: "user-teacher-888",
                    student_id: "user-student-999"
                }
            ]
        },
        metadata: {
            created_by: "user-admin-000",
            updated_by: "user-admin-111"
        }
    };

    context.log.info("Returning example data for enrichment");

    return new Response(
        JSON.stringify(exampleData),
        {
            status: 200,
            headers: { "Content-Type": "application/json" }
        }
    );
} 