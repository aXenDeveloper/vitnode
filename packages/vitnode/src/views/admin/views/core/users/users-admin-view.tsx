import { DataTable } from '@/components/table/data-table';

export const UsersAdminView = () => {
  return (
    <div className="container mx-auto p-4">
      <DataTable
        columns={[
          { id: 'id', label: 'Id' },
          { id: 'name', label: 'Name' },
          { id: 'email', label: 'Email' },
          {
            id: 'role',
            label: 'Role',
            cell: ({ row }) => <span className="font-medium">{row.role}</span>,
          },
          {
            id: 'status',
            label: 'Status',
            cell: ({ row }) => (
              <span
                className={
                  row.status === 'active' ? 'text-green-600' : 'text-red-600'
                }
              >
                {row.status}
              </span>
            ),
          },
        ]}
        data={[
          {
            id: 'user1',
            name: 'Alice Smith',
            email: 'alice@example.com',
            role: 'admin',
            status: 'active',
          },
          {
            id: 'user2',
            name: 'Bob Johnson',
            email: 'bob@example.com',
            role: 'editor',
            status: 'inactive',
          },
          {
            id: 'user3',
            name: 'Charlie Lee',
            email: 'charlie@example.com',
            role: 'viewer',
            status: 'active',
          },
        ]}
      />
    </div>
  );
};
