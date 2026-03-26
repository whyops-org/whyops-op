import { Metadata } from 'next';
import React from 'react';

import { AgentsProvider } from '@/components/agents/agents-provider';

type Props = {
    children: React.ReactNode;
}

export const metadata: Metadata = {
  title: "Agents | WhyOps",
  description: "WhyOps Agents - Monitor your AI agents",
};

const Layout = (props: Props) => {
  return (
    <AgentsProvider initialAgents={[]} initialPagination={null}>
      {props.children}
    </AgentsProvider>
  );
}

export default Layout;
