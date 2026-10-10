import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mt-24 text-center">
      <h1 className="text-lg font-semibold">Not found</h1>
      <p className="mt-2 text-sm text-zinc-500">It doesn’t exist, or you don’t have access to it.</p>
      <Link href="/" className="btn mt-6">
        Back to tasks
      </Link>
    </div>
  );
}
