export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-1 text-sm text-slate-600">
          Welcome to the admin area.
        </p>
      </div>

      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-sm text-slate-700">
          Admin features coming in v0.8.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          The auth gate around this page is the proof the role check works.
        </p>
      </div>
    </div>
  );
}
