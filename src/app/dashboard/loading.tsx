export default function DashboardLoading() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header skeleton */}
      <header className="px-5 pt-6 pb-4 flex items-start justify-between">
        <div>
          <div className="h-4 w-28 skeleton mb-2" />
          <div className="h-8 w-44 skeleton" />
        </div>
        <div className="w-10 h-10 rounded-full skeleton" />
      </header>

      {/* Playlist card skeletons */}
      <div className="px-4 space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass rounded-2xl p-4 flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl skeleton shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 skeleton w-3/5" />
              <div className="h-3 skeleton w-2/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
