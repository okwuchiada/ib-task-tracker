'use client';

import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type SelectOption = string | { value: string; label: string };

/** shadcn Select for plain HTML forms (server actions): the value is submitted through a hidden input. */
export function FormSelect({
  name,
  options,
  defaultValue,
  placeholder,
  className,
  'aria-label': ariaLabel,
}: {
  name: string;
  options: SelectOption[];
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? '');
  const items = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));

  return (
    <>
      <Select value={value || undefined} onValueChange={setValue}>
        <SelectTrigger className={className} aria-label={ariaLabel}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {items.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value && <input type="hidden" name={name} value={value} />}
    </>
  );
}
