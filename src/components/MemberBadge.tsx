"use client";

interface MemberBadgeProps {
  displayName: string;
  avatarUrl: string | null;
  size?: "sm" | "md" | "lg";
  hasListened?: boolean;
  listenedAt?: string | null;
  tooltip?: string;
}

export default function MemberBadge({
  displayName,
  avatarUrl,
  size = "md",
  hasListened,
  listenedAt,
  tooltip,
}: MemberBadgeProps) {
  const sizeClasses = {
    sm: "w-6 h-6 text-[10px]",
    md: "w-8 h-8 text-xs",
    lg: "w-10 h-10 text-sm",
  };

  const tooltipText = tooltip || (hasListened !== undefined
    ? `${displayName} ${hasListened ? "listened" : "hasn't listened yet"}${listenedAt ? ` - ${new Date(listenedAt).toLocaleDateString()}` : ""}`
    : displayName);

  return (
    <div className="relative" data-tooltip={tooltipText}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={displayName}
          className={`${sizeClasses[size]} rounded-full object-cover ${
            hasListened === false ? "opacity-40 grayscale" : ""
          } ${hasListened === true ? "ring-2 ring-spotify" : ""}`}
        />
      ) : (
        <div
          className={`${sizeClasses[size]} rounded-full bg-card flex items-center justify-center font-medium ${
            hasListened === false ? "opacity-40" : ""
          } ${hasListened === true ? "ring-2 ring-spotify" : ""}`}
        >
          {displayName[0]}
        </div>
      )}
      {hasListened === true && (
        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-spotify rounded-full flex items-center justify-center">
          <svg className="w-2 h-2 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </div>
  );
}
