'use client';

import React from 'react';

export const TestLayout = ({ children }: { children: React.ReactNode }) => {
  const [count, setCount] = React.useState(0);

  return (
    <div>
      <h1>Test Layout</h1>
      <p>This is a test layout component.</p>

      <div>
        <p>Count: {count}</p>
        <button onClick={() => setCount(count + 1)}>Increment</button>
        <button onClick={() => setCount(count - 1)}>Decrement</button>
      </div>
      {children}
    </div>
  );
};
