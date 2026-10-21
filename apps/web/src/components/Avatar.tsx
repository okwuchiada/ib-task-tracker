import { Avatar as AvatarRoot, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

/** GitHub avatar with the login's first letter as a fallback. */
export function Avatar({ src, login, className }: { src?: string | null; login: string; className?: string }) {
  return (
    <AvatarRoot className={cn('size-9', className)}>
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback className="text-xs">{login.slice(0, 1).toUpperCase()}</AvatarFallback>
    </AvatarRoot>
  );
}
