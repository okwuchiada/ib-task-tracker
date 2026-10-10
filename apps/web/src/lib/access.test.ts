import { describe, expect, it } from 'vitest';
import { buildTaskVisibilityWhere, canEditGroup, canEditTask } from './access';

const member = { id: 'u1', role: 'MEMBER' as const, viewAllProjects: false };

describe('buildTaskVisibilityWhere', () => {
  it('limits a plain member to their own tasks', () => {
    expect(buildTaskVisibilityWhere(member, [])).toEqual({ OR: [{ createdById: 'u1' }] });
  });

  it('adds granted projects', () => {
    expect(buildTaskVisibilityWhere(member, ['p1', 'p2'])).toEqual({
      OR: [{ createdById: 'u1' }, { projectId: { in: ['p1', 'p2'] } }],
    });
  });

  it('gives "view all projects" members no filter', () => {
    expect(buildTaskVisibilityWhere({ ...member, viewAllProjects: true }, [])).toEqual({});
  });

  it('gives admins no filter', () => {
    expect(buildTaskVisibilityWhere({ ...member, role: 'ADMIN' }, [])).toEqual({});
  });
});

describe('edit rights', () => {
  it('lets creators and admins edit, not others', () => {
    expect(canEditTask(member, { createdById: 'u1' })).toBe(true);
    expect(canEditTask(member, { createdById: 'u2' })).toBe(false);
    expect(canEditTask({ ...member, role: 'ADMIN' }, { createdById: 'u2' })).toBe(true);
    expect(canEditGroup(member, { createdById: 'u2' })).toBe(false);
    // "view all" grants visibility only, not edit rights
    expect(canEditTask({ ...member, viewAllProjects: true }, { createdById: 'u2' })).toBe(false);
  });
});
