'use client';

import { useState } from 'react';
import { Info, ChevronRight, Check, Minus } from 'lucide-react';
import GlassDrawer from '@/components/ui/glass-drawer';

export default function SpotifyChangesBanner() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <div className="relative z-50 w-full bg-brand/10 border-b border-brand/20 px-5 py-2.5">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Info className="w-4 h-4 text-brand shrink-0" />
          <p className="text-sm text-text-secondary flex-1 min-w-0">
            See what you get with Swapify.{' '}
            <button
              onClick={() => setDrawerOpen(true)}
              className="text-brand hover:text-brand-hover inline-flex items-center gap-0.5 font-medium transition-colors"
            >
              Compare experiences
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </p>
        </div>
      </div>

      <GlassDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="How Swapify Works"
        snapPoint="full"
      >
        <div className="space-y-8">
          {/* Intro */}
          <p className="text-base leading-relaxed text-text-secondary">
            Swapify is a shared music inbox. Everyone gets something different depending on how they
            connect.
          </p>

          {/* Feature matrix */}
          <section>
            <div className="glass rounded-xl overflow-hidden">
              {/* Column headers */}
              <div className="grid grid-cols-[1fr_4.5rem_4.5rem_4.5rem] items-end gap-0 border-b border-glass-border px-4 py-3">
                <span className="text-xs text-text-tertiary uppercase tracking-wider">Feature</span>
                <span className="text-center text-xs font-semibold text-brand leading-tight">
                  Host
                </span>
                <span className="text-center text-xs font-semibold text-accent-green leading-tight">
                  Member
                </span>
                <span className="text-center text-xs font-semibold text-[#1DB954] leading-tight">
                  Listener
                </span>
              </div>

              {/* Rows */}
              {[
                {
                  key: 'listen',
                  feature: 'Listen on Spotify',
                  host: true,
                  member: true,
                  listener: true,
                },
                { key: 'add', feature: 'Add tracks', host: true, member: true, listener: false },
                {
                  key: 'react',
                  feature: 'React to tracks',
                  host: true,
                  member: true,
                  listener: false,
                },
                {
                  key: 'liked',
                  feature: 'Save to Liked',
                  host: true,
                  member: true,
                  listener: false,
                },
                {
                  key: 'tracking',
                  feature: 'Auto listen tracking',
                  host: true,
                  member: true,
                  listener: false,
                  tooltip: "Swapify detects when you've heard a song and marks it as listened",
                },
                {
                  key: 'cycling',
                  feature: 'Smart track cycling',
                  host: true,
                  member: true,
                  listener: false,
                  tooltip: 'Tracks are removed once everyone has heard them',
                },
                {
                  key: 'settings',
                  feature: 'Manage settings',
                  host: true,
                  member: false,
                  listener: false,
                },
                {
                  key: 'nosetup',
                  feature: 'No setup needed',
                  host: false,
                  member: false,
                  listener: true,
                },
              ].map((row, i) => (
                <div
                  key={row.key}
                  className={`grid grid-cols-[1fr_4.5rem_4.5rem_4.5rem] items-center gap-0 px-4 py-2.5 ${
                    i % 2 === 0 ? 'bg-white/2' : ''
                  }`}
                >
                  <span className="text-sm text-text-secondary">
                    {row.tooltip ? (
                      <span
                        className="border-b border-dotted border-text-tertiary cursor-help"
                        data-tooltip={row.tooltip}
                      >
                        {row.feature}
                      </span>
                    ) : (
                      row.feature
                    )}
                  </span>
                  <span className="flex justify-center">
                    {row.host ? (
                      <Check className="w-4 h-4 text-brand" />
                    ) : (
                      <Minus className="w-4 h-4 text-text-tertiary/40" />
                    )}
                  </span>
                  <span className="flex justify-center">
                    {row.member ? (
                      <Check className="w-4 h-4 text-accent-green" />
                    ) : (
                      <Minus className="w-4 h-4 text-text-tertiary/40" />
                    )}
                  </span>
                  <span className="flex justify-center">
                    {row.listener ? (
                      <Check className="w-4 h-4 text-[#1DB954]" />
                    ) : (
                      <Minus className="w-4 h-4 text-text-tertiary/40" />
                    )}
                  </span>
                </div>
              ))}
            </div>

            {/* Capacity note */}
            <p className="text-xs text-text-tertiary mt-3">
              Each Swaplist supports 1 host + up to 5 connected members. Unlimited Spotify listeners
              can follow along.
            </p>
          </section>

          {/* How tracks cycle */}
          <section>
            <h3 className="text-lg font-semibold text-text-primary mb-2">How tracks cycle out</h3>
            <p className="text-sm text-text-secondary leading-relaxed mb-3">
              The playlist refreshes itself. Whichever happens first:
            </p>
            <div className="space-y-2">
              <div className="flex items-start gap-3 text-sm text-text-secondary">
                <span className="mt-1.5 w-2 h-2 rounded-full bg-accent-green shrink-0" />
                <span>
                  <span className="font-medium text-text-primary">Heard by everyone</span> &mdash;
                  removed once all connected members have listened or reacted
                </span>
              </div>
              <div className="flex items-start gap-3 text-sm text-text-secondary">
                <span className="mt-1.5 w-2 h-2 rounded-full bg-brand shrink-0" />
                <span>
                  <span className="font-medium text-text-primary">Auto-refresh</span> &mdash;
                  removed after{' '}
                  <span
                    className="border-b border-dotted border-text-tertiary cursor-help"
                    data-tooltip="Hosts can change this or turn it off in settings"
                  >
                    7 days
                  </span>{' '}
                  regardless, so the playlist never goes stale
                </span>
              </div>
            </div>
            <p className="text-xs text-text-tertiary mt-2">
              Both can be adjusted by the host in Swaplist settings.
            </p>
          </section>

          {/* Getting started nudge */}
          <section className="glass rounded-xl p-4">
            <p className="text-sm text-text-secondary leading-relaxed">
              <span className="font-medium text-text-primary">Want the best experience?</span> Ask
              the host to invite you as a connected member so you get reactions, liked history, and
              automatic listen tracking. Or if you&apos;re starting a group, tap{' '}
              <span className="font-medium text-brand">Get Started</span> below.
            </p>
          </section>
        </div>
      </GlassDrawer>
    </>
  );
}
