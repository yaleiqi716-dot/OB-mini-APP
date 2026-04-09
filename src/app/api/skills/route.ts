import { NextRequest, NextResponse } from 'next/server';
import { groupRolesByDepartment, searchRoles } from '@/lib/skills/registry';
import { DEPARTMENT_LABELS, type SkillRoleDepartment } from '@/lib/skills/types';

// GET /api/skills — list starter AI colleague roles
//
// Query params:
//   ?q=<query>  optional substring search against name + description
//   ?flat=1     optional, return flat array instead of grouped-by-department
//
// Response shape (default, grouped):
//   {
//     departments: [
//       { key: 'marketing', label: '营销 · 内容', roles: [{id, name, description, color}, ...] },
//       ...
//     ]
//   }
//
// Response shape (?flat=1):
//   { roles: [{id, name, description, color, department}, ...] }
//
// This endpoint is NOT auth-gated. The role library is public data
// (it's the product's "menu" of AI colleagues). Users see the same
// list regardless of login state. Task creation is still auth-gated
// downstream.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const flat = searchParams.get('flat') === '1';

    // Search path — always flat, filtered.
    if (query) {
      const results = await searchRoles(query);
      return NextResponse.json({ roles: results });
    }

    // Flat path — all starter roles without grouping.
    if (flat) {
      const groups = await groupRolesByDepartment();
      const roles = groups.flatMap(g => g.roles);
      return NextResponse.json({ roles });
    }

    // Default path — grouped by department.
    const groups = await groupRolesByDepartment();
    return NextResponse.json({
      departments: groups.map(g => ({
        key: g.department,
        label:
          DEPARTMENT_LABELS[g.department as SkillRoleDepartment] ||
          g.department,
        roles: g.roles,
      })),
    });
  } catch (error) {
    console.error('[SKILLS_LIST_ERROR]', error);
    return NextResponse.json(
      { error: '加载 AI 同事列表失败' },
      { status: 500 },
    );
  }
}
