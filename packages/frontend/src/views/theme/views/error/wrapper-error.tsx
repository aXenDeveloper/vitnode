import { ErrorView } from './error-view';

export const WrapperError = ({
  error,
}: {
  error: { digest?: string } & Error;
}) => {
  return <ErrorView code={error.message === 'ACCESS_DENIED' ? '403' : '500'} />;
};
