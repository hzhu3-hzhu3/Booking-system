import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { RuleConfig, UpdateRuleConfigRequest } from '../types';
import { toast } from '../utils/toast';

async function updateRules(data: UpdateRuleConfigRequest): Promise<RuleConfig> {
  const response = await api.put<RuleConfig>('/api/rules', data);
  return response.data;
}

export function useUpdateRules() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateRules,
    onError: (error) => {
      const errorMessage =
        (error as any)?.response?.data?.error?.message ||
        (error as Error)?.message ||
        'Failed to update rules';
      
      toast.error(errorMessage);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      toast.success('Rules updated successfully!');
    },
  });
}
