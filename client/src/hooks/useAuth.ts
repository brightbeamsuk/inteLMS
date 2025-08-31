import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
    staleTime: 0, // Always revalidate
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user && !error,
  };
}
