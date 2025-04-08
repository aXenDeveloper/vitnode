import { ErrorView } from 'vitnode/views/error/error-view';

export default function NotFoundPage() {
  return <ErrorView code={404} />;
}
