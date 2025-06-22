import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

export default async function (request: ZuploRequest, context: ZuploContext) {
    // Get authenticated user info if available
    const user = (request as any).user;
    const authenticatedUserId = user?.sub || 'anonymous';

    // Example response that contains various user and course IDs
    // This data will be enriched by the response-enrichment outbound policy
    // Now adds a single user_info array with all user data instead of individual fields
    const exampleData = {
        message: "Example data with IDs that will be enriched with a user_info array",
        authenticated_user: authenticatedUserId, // This user's info will be included in user_info array
        course: {
            course_id: "course-123",
            title: "This will be enriched with course_title",
            teacher_id: "user-teacher-456", // Teacher info will be in user_info array
            aux_teacher_id: "user-aux-789", // Aux teacher info will be in user_info array
            students_ids: ["user-student-001", "user-student-002", "user-student-003"] // Student info will be in user_info array
        },
        posts: [
            {
                id: "post-1",
                author_id: "user-author-111", // Author info will be in user_info array
                content: "First post content"
            },
            {
                id: "post-2",
                author_id: "user-author-222", // Author info will be in user_info array
                content: "Second post content"
            }
        ],
        classroom: {
            teacher_uuid: "user-teacher-333", // Teacher info will be in user_info array
            teacher_ids: ["user-teacher-444", "user-teacher-555"], // These teachers' info will be in user_info array
            aux_teacher_ids: ["user-aux-666", "user-aux-777"], // These aux teachers' info will be in user_info array
            assignments: [
                {
                    id: "assignment-1",
                    course_id: "course-456", // Will add course_title
                    teacher_id: "user-teacher-888", // Teacher info will be in user_info array
                    student_id: "user-student-999" // Student info will be in user_info array
                }
            ]
        },
        metadata: {
            created_by_user_id: "user-admin-000", // Custom field - won't be included in user_info
            updated_by_user_id: "user-admin-111", // Custom field - won't be included in user_info
            note: "Only fields matching predefined mappings will have their users included in user_info array"
        },
        // After enrichment, this response will have a new field:
        // user_info: [
        //   { user_id: "user-teacher-456", name: "Prof. Juan Pérez", email: "juan@university.edu" },
        //   { user_id: "user-aux-789", name: "Asst. María García", email: "maria@university.edu" },
        //   { user_id: "user-student-001", name: "Ana López", email: "ana@student.edu" },
        //   // ... all other unique users found in the response
        // ]
    };

    context.log.info("Returning example data for enrichment with user_info array");

    return new Response(
        JSON.stringify(exampleData),
        {
            status: 200,
            headers: { "Content-Type": "application/json" }
        }
    );
} 