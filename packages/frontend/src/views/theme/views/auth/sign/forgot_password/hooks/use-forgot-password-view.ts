import React from 'react';
import { z } from 'zod';

export const useForgotPasswordView = () => {
  const [email, setEmail] = React.useState('');

  const formSchema = z.object({
    email: z.string().email().default(''),
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    setEmail(values.email);
  };

  return { formSchema, email, onSubmit };
};
