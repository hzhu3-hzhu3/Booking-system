import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { RuleConfig } from '../types';

async function fetchRules(): Promise<RuleConfig> {
  const response = await api.get<RuleConfig>('/api/rules');
  return response.data;
}

export function useRules() {
  return useQuery({
    queryKey: ['rules'],
    queryFn: fetchRules,
    staleTime: 10 * 60 * 1000, // 10 minutes - rules don't change often
  });
}
