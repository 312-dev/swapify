'use client';

import { type ReactNode } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface GlassDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** "half" limits height to ~50vh, "full" to ~90vh. Default: "full" */
  snapPoint?: 'half' | 'full';
  /** Slide direction. Default: "bottom" */
  direction?: 'top' | 'bottom';
}

const HEIGHT_CLASS: Record<string, string> = {
  half: 'max-h-[50dvh]',
  full: 'max-h-[90dvh]',
};

export default function GlassDrawer({
  isOpen,
  onClose,
  title,
  children,
  snapPoint = 'full',
  direction = 'bottom',
}: GlassDrawerProps) {
  const isDesktop = useMediaQuery('(min-width: 640px)');

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  // Desktop: centered dialog
  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="bg-[#1a1a1a] border-white/[0.12] sm:max-w-2xl max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            {title ? (
              <DialogTitle className="text-xl font-bold text-text-primary">{title}</DialogTitle>
            ) : (
              <DialogTitle className="sr-only">Dialog</DialogTitle>
            )}
            <DialogDescription className="sr-only">{title || 'Dialog panel'}</DialogDescription>
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    );
  }

  const isTop = direction === 'top';

  // Mobile: sliding drawer
  return (
    <Drawer open={isOpen} onOpenChange={handleOpenChange} direction={direction}>
      <DrawerContent
        className={`${isTop ? 'border-b rounded-b-[20px]' : 'border-t rounded-t-[20px]'} border-white/[0.12] !bg-[#1a1a1a] ${HEIGHT_CLASS[snapPoint]}`}
      >
        <DrawerHeader className="p-0">
          {title ? (
            <DrawerTitle
              className={`text-xl font-bold text-center ${isTop ? 'mt-2 mb-4' : 'mb-4'} px-6`}
            >
              {title}
            </DrawerTitle>
          ) : (
            <DrawerTitle className="sr-only">Drawer</DrawerTitle>
          )}
          <DrawerDescription className="sr-only">{title || 'Drawer panel'}</DrawerDescription>
        </DrawerHeader>

        <div
          className={`px-6 ${isTop ? 'pb-6' : 'pb-[calc(2rem+env(safe-area-inset-bottom))]'} overflow-y-auto`}
        >
          {children}
        </div>

        {/* Drag handle for top drawers */}
        {isTop && <div className="bg-muted mx-auto mb-4 h-2 w-[100px] shrink-0 rounded-full" />}
      </DrawerContent>
    </Drawer>
  );
}
