import { signOut } from "@/app/login/actions";

export function LogoutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-100"
      >
        Sign out
      </button>
    </form>
  );
}
