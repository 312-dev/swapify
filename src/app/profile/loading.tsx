export default function ProfileLoading() {
  return (
    <div className="min-h-screen">
      {/* Header skeleton */}
      <div className="gradient-bg-radial px-5 pt-10 pb-8 flex flex-col items-center text-center">
        <div className="w-24 h-24 rounded-full skeleton mb-4" />
        <div className="h-8 w-40 skeleton mb-4" />

        {/* Stats skeleton */}
        <div className="flex items-center gap-6 mt-2">
          <div className="text-center space-y-1">
            <div className="h-6 w-8 skeleton mx-auto" />
            <div className="h-3 w-16 skeleton" />
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center space-y-1">
            <div className="h-6 w-8 skeleton mx-auto" />
            <div className="h-3 w-20 skeleton" />
          </div>
        </div>
      </div>

      {/* Settings sections skeleton */}
      <div className="px-5 py-6 space-y-4">
        <div className="glass rounded-2xl p-5 space-y-4">
          <div className="h-4 w-40 skeleton" />
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
              <div className="h-4 w-32 skeleton" />
              <div className="h-3 w-48 skeleton" />
            </div>
            <div className="w-11 h-6 rounded-full skeleton" />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
              <div className="h-4 w-36 skeleton" />
              <div className="h-3 w-52 skeleton" />
            </div>
            <div className="w-11 h-6 rounded-full skeleton" />
          </div>
        </div>
      </div>
    </div>
  );
}
