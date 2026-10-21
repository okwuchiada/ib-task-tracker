'use client';

import { useActionState } from 'react';
import { createApiToken, type CreateTokenState } from '@/lib/actions';
import { CopyButton } from '@/components/CopyButton';
import { Field } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** Creates a token for CI and shows it once; only its hash is stored. */
export function CreateTokenForm() {
  const [state, action, pending] = useActionState<CreateTokenState, FormData>(createApiToken, {});
  return (
    <div className="space-y-3 px-(--card-spacing)">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <Field label="New token name" className="flex-1">
          <Input name="label" required minLength={2} maxLength={80} placeholder="GitHub Actions (ib-task-tracker)" />
        </Field>
        <Button disabled={pending}>Create token</Button>
      </form>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.token && (
        <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950">
          <p className="font-medium text-amber-800 dark:text-amber-300">
            Copy “{state.label}” now. It won’t be shown again.
          </p>
          <div className="flex items-start gap-2">
            <code className="flex-1 overflow-x-auto rounded-md bg-background p-2 text-xs break-all">{state.token}</code>
            <CopyButton text={state.token} />
          </div>
        </div>
      )}
    </div>
  );
}
