
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MountainIcon } from 'lucide-react'; // Or any other suitable icon

export default function AppHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <MountainIcon className="h-6 w-6 text-primary" />
          <span className="font-semibold text-lg">Stock Insights</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href="/summary">Summary</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/w-change">W.Change</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/w-report">W.Report</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
