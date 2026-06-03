import { DataTable } from "@vitnode/core/components/table/data-table";

export default function DataTableExample() {
  return (
    <DataTable
      columns={[
        { id: "name", label: "Name" },
        { id: "email", label: "Email" },
        { id: "role", label: "Role" },
        { id: "status", label: "Status" },
        { id: "id", label: "Actions" },
      ]}
      edges={[
        {
          id: 1,
          name: "John Doe",
          email: "jon_doe@mail.com",
          role: "Admin",
          status: "Active",
        },
        {
          id: 2,
          name: "Jane Smith",
          email: "jane_smith@mail.com",
          role: "Editor",
          status: "Inactive",
        },
        {
          id: 3,
          name: "Alice Johnson",
          email: "alice_johnson@mail.com",
          role: "Viewer",
          status: "Active",
        },
        {
          id: 4,
          name: "Bob Brown",
          email: "bob_brown@mail.com",
          role: "Admin",
          status: "Inactive",
        },
      ]}
      id="users-table"
      order={{
        defaultOrder: {
          column: "name",
          order: "asc",
        },
      }}
      pageInfo={{
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: 1,
        endCursor: 1,
        count: 1,
        totalCount: 1,
      }}
    />
  );
}
