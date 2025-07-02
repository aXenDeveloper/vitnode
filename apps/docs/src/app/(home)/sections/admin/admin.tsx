import { CpuIcon, LockIcon, SparklesIcon } from 'lucide-react';
import Image from 'next/image';

import debugPanelImg from './debug_panel.png';

export const AdminSection = () => {
  return (
    <section className="py-16 md:py-32">
      <div className="mx-auto max-w-6xl space-y-12 px-6">
        <div className="flex items-center justify-center text-center">
          <h2 className="max-w-xl text-4xl font-semibold">
            Powerful AdminCP brings together all management tools
          </h2>
        </div>
        <div className="relative rounded-3xl p-3 md:-mx-8 lg:col-span-3">
          <div className="relative aspect-88/36">
            <div className="from-background absolute inset-0 z-1 bg-linear-to-t to-transparent"></div>
            <Image
              alt="payments illustration dark"
              className="hidden dark:block"
              height={1137}
              src={debugPanelImg}
              width={2797}
            />
            <Image
              alt="payments illustration light"
              className="dark:hidden"
              height={1137}
              src={debugPanelImg}
              width={2797}
            />
          </div>
        </div>
        <div className="relative mx-auto grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-8 lg:grid-cols-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CpuIcon className="size-4" />
              <h3 className="text-sm font-medium">Powerful</h3>
            </div>
            <p className="text-muted-foreground text-sm">
              Manage users, content and settings from one powerful command
              center.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CpuIcon className="size-4" />
              <h3 className="text-sm font-medium">Powerful</h3>
            </div>
            <p className="text-muted-foreground text-sm">
              Manage users, content and settings from one powerful command
              center.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <LockIcon className="size-4" />
              <h3 className="text-sm font-medium">Powerful</h3>
            </div>
            <p className="text-muted-foreground text-sm">
              Manage users, content and settings from one powerful command
              center.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <SparklesIcon className="size-4" />

              <h3 className="text-sm font-medium">Powerful</h3>
            </div>
            <p className="text-muted-foreground text-sm">
              Manage users, content and settings from one powerful command
              center.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
