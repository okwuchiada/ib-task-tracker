'use client';

import { Loader2Icon } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Field } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/** Radix Select can't have an empty value, so "All" uses this and removes the filter from the URL. */
const ALL = '__all__';
const SEARCH_DELAY_MS = 350;

export interface TaskFilterOptions {
  projects: string[];
  environments: string[];
  types: string[];
  statuses: string[];
  devs: string[];
}

/** The task list filters. Every change updates the URL straight away (search waits for a pause in typing). */
export function TaskFilters({ options }: { options: TaskFilterOptions }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const setFilter = (name: string, value: string, { replace = false } = {}) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    next.delete('page'); // a new filter starts from the first page
    const url = next.size ? `${pathname}?${next}` : pathname;
    startTransition(() => (replace ? router.replace(url) : router.push(url)));
  };

  // Search keeps its own draft so typing stays smooth; it follows the URL when that changes elsewhere (e.g. Clear).
  const urlQuery = params.get('q') ?? '';
  const [query, setQuery] = useState(urlQuery);
  // (Skipped when they only differ by spaces the URL trimmed, so a trailing space isn't eaten mid-typing.)
  useEffect(() => setQuery((draft) => (draft.trim() === urlQuery ? draft : urlQuery)), [urlQuery]);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(searchTimer.current), []);

  const onSearch = (value: string) => {
    setQuery(value);
    clearTimeout(searchTimer.current);
    // replace, not push: one history entry per search rather than one per keystroke
    searchTimer.current = setTimeout(() => setFilter('q', value.trim(), { replace: true }), SEARCH_DELAY_MS);
  };

  const hasFilters = [...params.keys()].some((k) => k !== 'page');

  return (
    <div className="flex flex-wrap items-end gap-3 px-(--card-spacing)">
      <Field label="Search">
        <Input
          type="search"
          value={query}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Task ID or title"
          className="w-56"
        />
      </Field>
      <FilterSelect label="Project" name="project" options={options.projects} params={params} onChange={setFilter} />
      <FilterSelect label="Environment" name="env" options={options.environments} params={params} onChange={setFilter} />
      <FilterSelect label="Type" name="type" options={options.types} params={params} onChange={setFilter} />
      <FilterSelect label="Status" name="status" options={options.statuses} params={params} onChange={setFilter} />
      <FilterSelect label="Developer" name="dev" options={options.devs} params={params} onChange={setFilter} />
      <Field label="From">
        <Input type="date" value={params.get('from') ?? ''} onChange={(e) => setFilter('from', e.target.value)} />
      </Field>
      <Field label="To">
        <Input type="date" value={params.get('to') ?? ''} onChange={(e) => setFilter('to', e.target.value)} />
      </Field>
      {hasFilters && (
        <Button
          variant="outline"
          onClick={() => {
            clearTimeout(searchTimer.current);
            startTransition(() => router.push(pathname));
          }}
        >
          Clear
        </Button>
      )}
      {pending && <Loader2Icon className="mb-2.5 size-4 animate-spin text-muted-foreground" aria-label="Loading" />}
    </div>
  );
}

function FilterSelect({
  label,
  name,
  options,
  params,
  onChange,
}: {
  label: string;
  name: string;
  options: string[];
  params: URLSearchParams;
  onChange: (name: string, value: string) => void;
}) {
  return (
    <Field label={label}>
      <Select value={params.get(name) || ALL} onValueChange={(v) => onChange(name, v === ALL ? '' : v)}>
        <SelectTrigger className="min-w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
