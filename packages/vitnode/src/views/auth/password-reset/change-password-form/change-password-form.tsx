'use client';

import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export const ChangePasswordForm = ({
  token,
  userId,
}: {
  token: string;
  userId: string;
}) => {
  return (
    <>
      <CardHeader className="text-center">
        <CardTitle>
          <h1>Change Password</h1>
        </CardTitle>
        <CardDescription>desc</CardDescription>
      </CardHeader>

      <CardContent>
        ChangePasswordForm - {token} - {userId}
      </CardContent>
    </>
  );
};
