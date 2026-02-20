'use client';

import { useState } from 'react';
import {
  Info,
  ChevronRight,
  Check,
  Minus,
  Users,
  ListMusic,
  Crown,
  UserPlus,
  Music,
} from 'lucide-react';
import GlassDrawer from '@/components/ui/glass-drawer';

const FEATURES = [
  { label: 'Add', tip: 'Add tracks to the Swaplist' },
  { label: 'React', tip: 'React to tracks with emoji' },
  { label: 'Save', tip: 'Save favorites to a personal liked playlist' },
  { label: 'Auto-listen', tip: "Swapify detects when you've heard a song" },
  { label: 'Auto-remove', tip: 'Tracks clear out once everyone has listened' },
  { label: 'Invite', tip: 'Invite new members to the circle' },
  { label: 'Settings', tip: 'Manage circle and Swaplist settings' },
] as const;

const ROLES = [
  {
    name: 'Host',
    desc: 'Creates the circle',
    color: 'text-brand',
    icon: Crown,
    features: [true, true, true, true, true, true, true],
  },
  {
    name: 'Member',
    desc: 'Joins via invite',
    color: 'text-accent-green',
    icon: UserPlus,
    features: [true, true, true, true, true, false, false],
  },
  {
    name: 'Collaborator',
    desc: 'Not in circle',
    color: 'text-text-tertiary',
    icon: Music,
    features: [true, false, true, false, false, false, false],
  },
];

export default function SpotifyChangesBanner() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer group"
      >
        <Info className="w-3.5 h-3.5 text-brand/60 group-hover:text-brand transition-colors" />
        <span>How it works</span>
        <ChevronRight className="w-3 h-3 text-brand/60 group-hover:text-brand group-hover:translate-x-0.5 transition-all" />
      </button>

      <GlassDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="How Swapify Works"
        snapPoint="full"
      >
        <div className="space-y-6">
          {/* Circles */}
          <section>
            <h3 className="text-xl font-semibold text-text-primary mb-2 flex items-center gap-2.5">
              <Users className="w-5 h-5 text-brand" />
              Circles
            </h3>
            <p className="text-base text-text-secondary leading-relaxed">
              A circle is your friend group on Swapify. One person creates a circle, then invites
              others to join. Everyone in a circle shares Swaplists together and can be in multiple
              circles for different groups of friends.
            </p>
          </section>

          {/* Swaplists */}
          <section>
            <h3 className="text-xl font-semibold text-text-primary mb-2 flex items-center gap-2.5">
              <ListMusic className="w-5 h-5 text-accent-green" />
              Swaplists
            </h3>
            <p className="text-base text-text-secondary leading-relaxed">
              A Swaplist is your group&apos;s musical mailbox. Everyone drops songs in, listens
              through each other&apos;s picks, and reacts. Once everyone&apos;s heard a track, it
              clears out automatically &mdash; or after 7 days, whichever comes first.
            </p>
          </section>

          {/* Feature matrix — transposed: roles as rows, features as columns */}
          <section>
            <p className="text-base text-text-secondary mb-3">
              Depending on how you join, you&apos;ll have different capabilities:
            </p>
            <div className="glass rounded-xl">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-glass-border">
                    <th className="text-left px-4 py-3 text-sm text-text-secondary uppercase tracking-wider">
                      Feature
                    </th>
                    {ROLES.map((role) => (
                      <th key={role.name} className="px-2 py-3 text-center">
                        <span
                          className={`flex flex-col items-center gap-1 text-sm font-medium ${role.color}`}
                        >
                          <role.icon className="w-4 h-4" />
                          {role.name}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FEATURES.map((f, fi) => (
                    <tr key={f.label} className={fi % 2 === 0 ? 'bg-white/2' : ''}>
                      <td className="px-4 py-2.5 text-sm text-text-secondary">{f.label}</td>
                      {ROLES.map((role) => (
                        <td key={role.name} className="px-2 py-2.5 text-center">
                          {role.features[fi] ? (
                            <Check className={`w-4 h-4 ${role.color} inline-block`} />
                          ) : (
                            <Minus className="w-4 h-4 text-text-tertiary/30 inline-block" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-text-secondary mt-3">
              Collaborators are Spotify users who add to the playlist directly, without joining the
              circle on Swapify.
            </p>
          </section>
        </div>
      </GlassDrawer>
    </>
  );
}
