import { redirect } from 'next/navigation';

/** Keep the original Today URL working, with a readable alternate entry point. */
export default function TodayAlias() {
  redirect('/owner/dashboard');
}
