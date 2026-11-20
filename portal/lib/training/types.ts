export type TrainingRole = 'owner' | 'admin' | 'coach';
export type Lesson = {
  id: string;
  title: string;
  section: string;
  kind: 'text' | 'video' | 'file' | 'checklist';
  body: string;
  assetId?: string;
  externalUrl?: string;
  transcript?: string;
  checklist?: string[];
  managerSignoff?: boolean;
};
export type Question = {
  id: string;
  prompt: string;
  options: string[];
  correct: number[];
};
export type CourseContent = {
  title: string;
  description: string;
  category: string;
  lessons: Lesson[];
  questions: Question[];
  passingScore: number;
  maxAttempts: number;
  acknowledgment: string;
  audience: (TrainingRole | 'staff')[];
  reviewDate: string | null;
};
export type Course = {
  id: string;
  tenant_id: string;
  draft: CourseContent;
  published_version: number | null;
  archived: boolean;
  editors: string[];
  updated_at: string;
  created_at: string;
  created_by: string;
  import_batch_id: string | null;
};
export type Revision = { course_id: string; version: number; content: CourseContent; published_at: string; published_by: string };
export type Assignment = {
  id: string; course_id: string; user_id: string; version: number; due_at: string | null;
  completed_at: string | null; acknowledged_at: string | null; acknowledged_name: string | null;
  source: string; path_id: string | null; created_at: string;
};
export type Progress = { assignment_id: string; lesson_id: string; completed_at: string; signed_off_by: string | null };
export type Attempt = { id: string; assignment_id: string; score: number; passed: boolean; created_at: string };
export type TrainingPerson = { id: string; email: string; name: string; role: TrainingRole; staff: boolean };
export type LearningPath = { id: string; title: string; description: string; course_ids: string[]; created_at: string };
export type MigrationItem = { sourceId: string; title: string; kind: string; status: 'ready' | 'blocked' | 'archived'; reason?: string; course?: CourseContent };
export type MigrationManifest = { format: 'ballpark-training-v1'; source: string; items: MigrationItem[]; historicalRecords?: { sourceId: string; email: string; courseSourceId: string; completedAt: string; score?: number; evidence?: string }[] };
export type MigrationBatch = { id: string; source: string; checksum: string; status: string; manifest: MigrationManifest; created_at: string; imported_at: string | null; rolled_back_at: string | null };
export type TrainingAsset = { id: string; filename: string; mime: string; size: number; checksum: string | null; status: string; created_at: string };
export type TrainingOverview = {
  viewer: { id: string; role: TrainingRole; canManage: boolean };
  courses: Course[];
  assignments: Assignment[];
  people: TrainingPerson[];
  paths: LearningPath[];
  batches: MigrationBatch[];
  assets: TrainingAsset[];
};
export const emptyCourse = (): CourseContent => ({
  title: '', description: '', category: 'Onboarding', lessons: [], questions: [],
  passingScore: 80, maxAttempts: 3, acknowledgment: '', audience: ['owner', 'admin', 'coach'], reviewDate: null,
});

/**
 * Browser API contract (all errors: {error:string} with non-2xx status).
 *
 * GET /api/training -> TrainingOverview, filtered for learner access.
 * GET /api/training/courses/:id -> {course, revisions:Revision[], assignment:Assignment|null,
 *   progress:Progress[], attempts:Attempt[], content:CourseContent}. ?assignmentId= selects enrollment.
 * POST /api/training/courses {draft:CourseContent} -> {id}
 * PATCH /api/training/courses/:id {draft,updated_at} | {action:'publish'|'archive'|'restore'|'duplicate'}
 *   | {action:'editors',editors:string[]} -> {id}
 * POST /api/training/assignments {courseId?,pathId?,userIds:string[],dueAt?:ISODate} -> {count}
 * POST /api/training/progress {assignmentId,lessonId,checked?:number[]} -> {ok:true}
 * POST /api/training/attempts {assignmentId,answers:Record<questionId,number[]>} -> {score,passed}
 * POST /api/training/complete {assignmentId,acknowledgedName?:string} -> {ok:true}
 * POST /api/training/signoff {assignmentId,lessonId} -> {ok:true}
 * POST /api/training/paths {title,description,courseIds:string[]} -> {id}
 * PATCH /api/training/paths/:id {title,description,courseIds:string[]} -> {id}
 * DELETE /api/training/paths/:id -> {ok:true} (only unassigned paths)
 * GET /api/training/reports -> {rows:ReportRow[],history:unknown[],audit:unknown[]}
 * GET /api/training/reports?format=csv -> attachment CSV
 * POST /api/training/migrations {manifest:MigrationManifest} -> {id,ready,blocked} (dry-run/stage only)
 * POST /api/training/migrations/:id {action:'import'|'rollback'|'export'} -> {count}|manifest
 * POST /api/training/assets {filename,mime,size} -> {id,path,token,signedUrl}
 *   PUT signedUrl with raw File and Content-Type to upload privately; then
 * POST /api/training/assets/:id {action:'confirm'} -> {ok:true}
 * GET /api/training/assets/:id -> {url} (short-lived signed URL)
 *
 * Learner course responses never include question.correct. Do not show answers to learners.
 * Published revisions immutable; assignment pins version. A published course is learned via an
 * enrollment. POST /assignments with one's own user ID allows self-enrollment in visible courses.
 * Lessons use plain text (preserves line breaks), never render arbitrary imported HTML.
 * ReportRow = {assignmentId,courseId,course,userId,name,email,version,dueAt,completedAt,
 * acknowledgedAt,acknowledgedName,progress,total,score,status,source}
 */
