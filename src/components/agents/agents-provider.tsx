'use client';

import { createContext, useContext } from 'react';

import type { Agent, Pagination } from '@/types/global';

interface AgentsContextValue {
  initialAgents: Agent[];
  initialPagination?: Pagination | null;
}

const AgentsContext = createContext<AgentsContextValue>({
  initialAgents: [],
  initialPagination: null,
});

export function useAgentsContext() {
  return useContext(AgentsContext);
}

interface AgentsProviderProps {
  children: React.ReactNode;
  initialAgents: Agent[];
  initialPagination?: Pagination | null;
}

export function AgentsProvider({ children, initialAgents, initialPagination }: AgentsProviderProps) {
  return (
    <AgentsContext.Provider value={{ initialAgents, initialPagination }}>
      {children}
    </AgentsContext.Provider>
  );
}
