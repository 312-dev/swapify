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
  /** "half" limits height to ~50vh, "full" to ~90vh. Default: "full" */
  snapPoint?: 'half' | 'full';
}

const HEIGHT_CLASS: Record<string, string> = {
  half: 'max-h-[50vh]',
  full: 'max-h-[90vh]',
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
    >
      <DrawerContent
        className={`border-t border-white/[0.12] rounded-t-[20px] !bg-[#1a1a1a] ${HEIGHT_CLASS[snapPoint]}`}
      >
        {/* Accessible title — handle bar provided by DrawerContent */}
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
