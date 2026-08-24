import {
  type ColumnDef,
  DataTable,
} from "@vitnode/core/components/table/data-table";

import { DeleteBulkAction } from "@/components/examples/delete-bulk-action";

interface DemoUser {
  email: string;
  id: number;
  name: string;
  role: string;
}

const columns: ColumnDef<DemoUser>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "email", header: "Email" },
  { accessorKey: "role", header: "Role" },
];

const edges: DemoUser[] = [
  { id: 1, name: "John Doe", email: "jon_doe@mail.com", role: "Admin" },
  { id: 2, name: "Jane Smith", email: "jane_smith@mail.com", role: "Editor" },
  {
    id: 3,
    name: "Alice Johnson",
    email: "alice_johnson@mail.com",
    role: "Viewer",
  },
  { id: 4, name: "Bob Brown", email: "bob_brown@mail.com", role: "Admin" },
];

export default function DataTableBulkActionsExample() {
  return (
    <DataTable
      bulkActions={<DeleteBulkAction />}
      columns={columns}
      edges={edges}
      id="users-bulk-table"
      order={{
        defaultOrder: {
          column: "name",
          order: "asc",
        },
      }}
      pageInfo={{
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: null,
        endCursor: null,
        count: edges.length,
        totalCount: edges.length,
      }}
    />
  );
}
