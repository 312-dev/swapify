export default function ActivityLoading() {
  return (
    <div className="min-h-screen">
      <div className="px-5 pt-8 pb-4">
        <h1 className="text-3xl font-bold text-text-primary">Activity</h1>
        <p className="text-base text-text-tertiary mt-1">Recent updates across your Swaplists</p>
      </div>

      <div className="px-5 space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <div className="w-10 h-10 rounded-full skeleton shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 skeleton w-3/4" />
              <div className="h-2.5 skeleton w-1/2" />
            </div>
            <div className="w-10 h-10 rounded-lg skeleton shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
