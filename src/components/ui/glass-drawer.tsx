'use client';

import { type ReactNode } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';

interface GlassDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** "half" snaps to ~50vh, "full" snaps to ~90vh. Default: "full" */
  snapPoint?: 'half' | 'full';
}

const SNAP_POINTS: Record<string, [number, number]> = {
  half: [0.5, 1],
  full: [0.9, 1],
};

export default function GlassDrawer({
  isOpen,
  onClose,
  title,
  children,
  snapPoint = 'full',
}: GlassDrawerProps) {
  return (
    <Drawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      snapPoints={SNAP_POINTS[snapPoint]}
    >
      <DrawerContent className="border-t border-white/[0.08] rounded-t-[20px] bg-[var(--surface-elevated)] backdrop-blur-xl max-h-[90vh]">
        {/* Handle bar */}
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-3 mb-2" />

        {/* Accessible title */}
        <DrawerHeader className="p-0">
          {title ? (
            <DrawerTitle className="text-xl font-bold text-center mb-4 px-6">{title}</DrawerTitle>
          ) : (
            <DrawerTitle className="sr-only">Drawer</DrawerTitle>
          )}
          <DrawerDescription className="sr-only">{title || 'Drawer panel'}</DrawerDescription>
        </DrawerHeader>

        {/* Content */}
        <div className="px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] overflow-y-auto">
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
