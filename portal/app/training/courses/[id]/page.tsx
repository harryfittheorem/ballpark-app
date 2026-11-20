import TrainingApp from '@/components/training/TrainingApp';
export default async function TrainingCoursePage({params}:{params:Promise<{id:string}>}) {
  return <TrainingApp courseId={(await params).id} />;
}
