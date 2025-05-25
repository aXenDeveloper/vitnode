import { Link } from '@vitnode/core/lib/navigation';

import { Test } from '../../views/test';
import { TestClient } from '../../views/test/client';

export default function Page() {
  return (
    <>
      <Test />
      <TestClient />
      <Link href="/blog/test">Go to blog - test 123</Link>
    </>
  );
}
