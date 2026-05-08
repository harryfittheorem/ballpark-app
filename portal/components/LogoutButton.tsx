import { signOut } from "@/app/login/actions";

export function LogoutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="rounded-xl border border-border-gold bg-darkest px-3 py-1.5 text-xs font-medium text-cream transition-colors hover:border-gold hover:text-gold"
      >
        Sign out
      </button>
    </form>
  );
}
