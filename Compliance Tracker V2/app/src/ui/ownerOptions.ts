/* The owner list as filter options: Unassigned first, then everyone, each with
   their avatar and role. Shared by every multi-select owner filter. */

import { STAFF } from "../domain/book.ts";
import type { PillOption } from "./Filters.tsx";

export const OWNER_OPTIONS: PillOption[] = [
  { value: "none", label: "Unassigned", avatar: "—" },
  ...STAFF.map((s) => ({ value: s.id, label: s.name, avatar: s.initials, sub: s.role })),
];
