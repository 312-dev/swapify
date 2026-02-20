'use client';

import MemberBadge from './MemberBadge';

interface MemberProgress {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  hasListened: boolean;
  listenedAt: string | null;
  listenCount: number;
}

interface ProgressIndicatorProps {
  progress: MemberProgress[];
  listenedCount: number;
  totalRequired: number;
}

export default function ProgressIndicator({
  progress,
  listenedCount,
  totalRequired,
}: ProgressIndicatorProps) {
  const percentage = totalRequired > 0 ? (listenedCount / totalRequired) * 100 : 0;
  const isComplete = listenedCount >= totalRequired && totalRequired > 0;

  return (
    <div className="space-y-2">
      {/* Avatar stack */}
      <div className="flex items-center gap-3">
        <div className="avatar-stack flex">
          {progress.map((member) => (
            <MemberBadge
              key={member.id}
              displayName={member.displayName}
              avatarUrl={member.avatarUrl}
              size="sm"
              hasListened={member.hasListened}
              listenedAt={member.listenedAt}
              listenCount={member.listenCount}
            />
          ))}
        </div>
        <span className="text-sm text-muted">
          {isComplete ? (
            <span className="text-brand font-medium">All listened!</span>
          ) : (
            `${listenedCount}/${totalRequired} listened`
          )}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-border rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 progress-bar-animated ${
            isComplete ? 'bg-brand' : 'bg-brand/60'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
