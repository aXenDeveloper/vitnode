'use client';

import { DataTable } from '@/components/table/data-table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVerticalIcon } from 'lucide-react';

export const UsersAdminView = () => {
  return (
    <div className="container mx-auto p-4">
      <DataTable
        columns={[
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
          {
            id: 'id',
            label: 'Actions',
            cell: () => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    className="text-muted-foreground data-[state=open]:bg-muted flex size-8"
                    size="icon"
                    variant="ghost"
                  >
                    <MoreVerticalIcon />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32">
                  <DropdownMenuItem>Edit</DropdownMenuItem>
                  <DropdownMenuItem>Make a copy</DropdownMenuItem>
                  <DropdownMenuItem>Favorite</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
