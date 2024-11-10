import { ErrorView } from './error-view';

export const WrapperError = ({
  error,
}: {
  error: { digest?: string } & Error;
}) => {
  return <ErrorView code={error.message.includes('403') ? '403' : '500'} />;
};
