import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';

interface TMin {
  id: string;
}

export function DataTable<T extends TMin>({
  data,
  columns,
  pageInfo,
  ...props
}: Omit<React.ComponentProps<typeof Table>, 'columns'> & {
  columns: {
    cell?: (data: { allData: T[]; row: T }) => React.ReactNode;
    id: keyof T;
    label: string;
  }[];
  data: T[];
  pageInfo: {
    count: number;
    endCursor: null | number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: null | number;
    totalCount: number;
  };
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="relative w-full overflow-auto">
        <Table {...props}>
          <TableHeader className="bg-muted sticky top-0 z-10">
            <TableRow>
              {columns.map(column => (
                <TableHead key={column.id.toString()}>{column.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {data.length ? (
              data.map(row => (
                <TableRow key={row.id}>
                  {columns.map(column => {
                    const content =
                      column.cell?.({
                        allData: data,
                        row,
                      }) ?? String(row[column.id]);

                    return (
                      <TableCell key={`${row.id}_${column.id.toString()}`}>
                        {content}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell className="text-center" colSpan={columns.length}>
                  Not Found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
