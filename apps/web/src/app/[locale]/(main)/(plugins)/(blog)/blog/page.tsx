import { Link } from 'vitnode/lib/navigation';

import { Test } from 'vitnode-blog/views/test';
import { TestClient } from 'vitnode-blog/views/test/client';

export default function Page() {
  return (
    <>
      <Test />
      <TestClient />
      <Link href="/blog/test">Go to blog - test 123</Link>
    </>
  );
}
