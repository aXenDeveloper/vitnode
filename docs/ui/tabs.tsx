'use client';

import React from 'react';
import { Tabs, TabsItem } from 'vitnode-frontend/components/ui/tabs';

export const TabsDemo = () => {
  const [activeTab, setActiveTab] = React.useState(0);

  return (
    <Tabs>
      <TabsItem
        active={activeTab === 0}
        onClick={() => {
          setActiveTab(0);
        }}
      >
        Item 1
      </TabsItem>
      <TabsItem
        active={activeTab === 1}
        onClick={() => {
          setActiveTab(1);
        }}
      >
        Item 2
      </TabsItem>
      <TabsItem
        active={activeTab === 2}
        onClick={() => {
          setActiveTab(2);
        }}
      >
        Item 3
      </TabsItem>
    </Tabs>
  );
};
