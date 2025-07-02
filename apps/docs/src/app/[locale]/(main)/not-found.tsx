import { ErrorView } from '@vitnode/core/views/error/error-view';

export default function NotFoundPage() {
  return <ErrorView code={404} />;
}
