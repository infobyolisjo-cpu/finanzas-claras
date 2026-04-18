'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const DashboardSkeleton = () => (
  <div className="space-y-6">
    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
      <div>
        <Skeleton className="h-9 w-48 rounded-md" />
        <Skeleton className="h-5 w-80 mt-2 rounded-md" />
      </div>
      <Skeleton className="h-10 w-44 rounded-md" />
    </div>
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Skeleton className="h-32 rounded-lg" />
      <Skeleton className="h-32 rounded-lg" />
      <Skeleton className="h-32 rounded-lg" />
      <Skeleton className="h-32 rounded-lg" />
    </div>
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <Skeleton className="lg:col-span-2 h-80 rounded-lg" />
      <Skeleton className="h-80 rounded-lg" />
    </div>
    <Skeleton className="h-80 rounded-lg" />
    <Skeleton className="h-64 rounded-lg" />
  </div>
);

const DashboardClient = dynamic(
  () => import('@/components/dashboard/dashboard-client').then(mod => mod.DashboardClient),
  {
    ssr: false,
    loading: () => <DashboardSkeleton />,
  }
);

export default function DashboardPage() {
  return <DashboardClient />;
}
