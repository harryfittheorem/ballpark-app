// Intentionally not an environment toggle: adult messaging needs an approved
// resource/action/consent policy, not an accidental configuration change.
export function instructorMessagingApproved(): boolean {
  return false;
}
export const instructorMessagingGate = 'Instructor-to-player messaging is unavailable. Adult messaging awaits policy approval.';
