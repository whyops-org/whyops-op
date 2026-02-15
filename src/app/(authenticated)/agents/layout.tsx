import { Metadata } from 'next';
import React from 'react';

import { AgentsProvider } from '@/components/agents/agents-provider';
import { fetchApiConfig } from '@/lib/api-config';
import { cookies } from 'next/headers';

type Props = {
    children: React.ReactNode;
}

export const metadata: Metadata = {
  title: "Agents | WhyOps",
  description: "WhyOps Agents - Monitor your AI agents",
};

async function getInitialAgents(page = 1, count = 20) {
  const config = await fetchApiConfig();
  const analyseBaseUrl = config?.analyseBaseUrl;

  const cookieStore = await cookies();
  const cookie = cookieStore.toString();

  if (!analyseBaseUrl) {
    return { agents: [], pagination: null };
  }

  try {
    const response = await fetch(`${analyseBaseUrl}/entities?page=${page}&count=${count}`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        cookie
      },
    });

    if (!response.ok) {
      return { agents: [], pagination: null };
    }

    const data = await response.json();
    return { agents: data.agents || [], pagination: data.pagination || null };
  } catch {
    return { agents: [], pagination: null };
  }
}

const Layout = async (props: Props) => {
  const { agents, pagination } = await getInitialAgents();

  return (
    <AgentsProvider initialAgents={agents} initialPagination={pagination}>
      {props.children}
    </AgentsProvider>
  );
}

export default Layout;
