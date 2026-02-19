export default function PlaylistDetailLoading() {
  return (
    <main className="min-h-screen">
      {/* Gradient header skeleton */}
      <div className="gradient-bg-radial px-5 pt-8 pb-6">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="w-6 h-6 skeleton rounded" />
          <div className="w-6 h-6 skeleton rounded" />
        </div>

        {/* Cover + info skeleton */}
        <div className="flex flex-col items-center text-center">
          <div
            className="w-44 h-44 rounded-2xl skeleton mb-5"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
          />
          <div className="h-8 w-48 skeleton mb-2" />
          <div className="h-4 w-32 skeleton mb-3" />

          {/* Member avatars skeleton */}
          <div className="flex items-center gap-3 mt-1">
            <div className="flex">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="w-7 h-7 rounded-full skeleton"
                  style={{ marginLeft: i > 0 ? '-8px' : 0, border: '2px solid var(--background)' }}
                />
              ))}
            </div>
            <div className="h-3 w-24 skeleton" />
          </div>

          {/* Action pills skeleton */}
          <div className="flex items-center gap-2 mt-5">
            <div className="h-8 w-16 skeleton rounded-full" />
            <div className="h-8 w-16 skeleton rounded-full" />
          </div>
        </div>
      </div>

      {/* Tab bar skeleton */}
      <div className="flex border-b border-white/[0.08] px-5">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex-1 py-3 flex justify-center">
            <div className="h-4 w-14 skeleton" />
          </div>
        ))}
      </div>

      {/* Track list skeleton */}
      <div className="px-4 mt-4 space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass rounded-xl p-3 flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg skeleton shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 skeleton w-3/5" />
              <div className="h-3 skeleton w-2/5" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
