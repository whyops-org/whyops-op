'use client';

import { createContext, useContext, useRef } from 'react';

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
  const initialized = useRef(false);

  if (!initialized.current && initialAgents.length > 0) {
    initialized.current = true;
  }

  return (
    <AgentsContext.Provider value={{ initialAgents, initialPagination }}>
      {children}
    </AgentsContext.Provider>
  );
}
