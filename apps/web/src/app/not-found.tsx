import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="mt-24 text-center">
      <h1 className="text-lg font-semibold">Not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">It doesn’t exist, or you don’t have access to it.</p>
      <Button variant="outline" className="mt-6" asChild>
        <Link href="/">Back to tasks</Link>
      </Button>
    </div>
  );
}
