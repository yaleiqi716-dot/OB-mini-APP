import { NextResponse } from 'next/server';
import { MCP_CATALOG } from '@/services/mcp/catalog';

export const runtime = 'nodejs';

// GET /api/mcp/catalog
//   Returns the curated list of installable MCP servers. Static content —
//   comes from src/services/mcp/catalog.ts, not the DB.
//   No auth required (catalog is public; install is auth'd).
export async function GET() {
  return NextResponse.json(
    MCP_CATALOG.map(e => ({
      kind: e.kind,
      label: e.label,
      tagline: e.tagline,
      description: e.description,
      scopes: e.scopes,
      fields: e.fields,
      confirmWarning: e.confirmWarning || null,
      icon: e.icon,
    })),
  );
}
