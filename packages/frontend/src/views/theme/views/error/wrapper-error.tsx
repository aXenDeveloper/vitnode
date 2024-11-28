import { ErrorView } from './error-view';

export const WrapperError = ({
  error,
}: {
  error: Error & { digest?: string };
}) => {
  return <ErrorView code={error.message.includes('403') ? '403' : '500'} />;
};
