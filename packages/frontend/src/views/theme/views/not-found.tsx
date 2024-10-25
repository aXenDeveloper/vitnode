import Error from 'next/error';

export const NotFoundView = () => {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Error statusCode={404} />
      </body>
    </html>
  );
};
