import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  SportsResponse,
  QuizSessionResponse,
  QuizQuestion,
  QuizCheckRequest,
  QuizCheckResponse,
  GameCompleteRequest,
  GameResultResponse,
  SurvivalStartResponse,
  SurvivalGuessResponse,
  SurvivalHintResponse,
  SurvivalSkipResponse,
  SurvivalCompleteRequest,
  LeaderboardResponse,
  ProfileResponse,
  Achievement,
  UserAchievement,
  AchievementCheckResponse,
  PendingChallengesResponse,
  CreateChallengeRequest,
} from "@/types/api";

// ---- Sports ----

export function useSports() {
  return useQuery({
    queryKey: ["sports"],
    queryFn: () => api.get<SportsResponse>("/sports"),
    staleTime: 5 * 60 * 1000,
  });
}

// ---- Quiz ----

export function useCreateQuizSession() {
  return useMutation({
    mutationFn: ({ sport, limit }: { sport: string; limit?: number }) =>
      api.post<QuizSessionResponse>(
        `/${sport}/quiz/session${limit ? `?limit=${limit}` : ""}`,
      ),
  });
}

export function useQuizQuestion(
  sport: string,
  sessionId: string | null,
  difficulty: string,
) {
  return useQuery({
    queryKey: ["quiz-question", sport, sessionId, difficulty],
    queryFn: () =>
      api.get<QuizQuestion>(
        `/${sport}/quiz/question?session_id=${sessionId}&difficulty=${difficulty}`,
      ),
    enabled: !!sessionId,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useCheckAnswer() {
  return useMutation({
    mutationFn: ({ sport, data }: { sport: string; data: QuizCheckRequest }) =>
      api.post<QuizCheckResponse>(`/${sport}/quiz/check`, data),
  });
}

export function useCompleteQuiz() {
  return useMutation({
    mutationFn: ({ sport, data }: { sport: string; data: GameCompleteRequest }) =>
      api.post<GameResultResponse>(`/${sport}/quiz/complete`, data),
  });
}

// ---- Survival ----

export function useStartSurvival() {
  return useMutation({
    mutationFn: (sport: string) =>
      api.post<SurvivalStartResponse>("/survival/start", { sport }),
  });
}

export function useSubmitGuess() {
  return useMutation({
    mutationFn: (data: { guess: string; session_id: string }) =>
      api.post<SurvivalGuessResponse>("/survival/guess", data),
  });
}

export function useSurvivalHint() {
  return useMutation({
    mutationFn: (sessionId: string) =>
      api.post<SurvivalHintResponse>(`/survival/session/${sessionId}/hint`),
  });
}

export function useSurvivalSkip() {
  return useMutation({
    mutationFn: (sessionId: string) =>
      api.post<SurvivalSkipResponse>(`/survival/session/${sessionId}/skip`),
  });
}

export function useCompleteSurvival() {
  return useMutation({
    mutationFn: ({
      sport,
      data,
    }: {
      sport: string;
      data: SurvivalCompleteRequest;
    }) => api.post<GameResultResponse>(`/${sport}/survival/complete`, data),
  });
}

// ---- Leaderboard ----

export function useLeaderboard(
  sport: string | null,
  mode: string | null,
  period: string,
  limit = 20,
) {
  const path =
    sport && mode
      ? `/leaderboards/${sport}/${mode}?period=${period}&limit=${limit}`
      : `/leaderboards/global?period=${period}&limit=${limit}`;

  return useQuery({
    queryKey: ["leaderboard", sport, mode, period, limit],
    queryFn: () => api.get<LeaderboardResponse>(path),
  });
}

// ---- Profile ----

export function useProfile(userId: string | null) {
  return useQuery({
    queryKey: ["profile", userId],
    queryFn: () => api.get<ProfileResponse>(`/profile/${userId}`),
    enabled: !!userId,
  });
}

// ---- Achievements ----

export function useAchievements() {
  return useQuery({
    queryKey: ["achievements"],
    queryFn: () => api.get<Achievement[]>("/achievements/"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUserAchievements(userId: string | null) {
  return useQuery({
    queryKey: ["user-achievements", userId],
    queryFn: () => api.get<UserAchievement[]>(`/achievements/user/${userId}`),
    enabled: !!userId,
  });
}

export function useCheckAchievements() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api.post<AchievementCheckResponse>(`/achievements/check/${userId}`),
    onSuccess: (_data, userId) => {
      qc.invalidateQueries({ queryKey: ["user-achievements", userId] });
    },
  });
}

// ---- Challenges ----

export function usePendingChallenges() {
  return useQuery({
    queryKey: ["challenges-pending"],
    queryFn: () => api.get<PendingChallengesResponse>("/challenges/pending"),
  });
}

export function useCreateChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateChallengeRequest) =>
      api.post("/challenges/create", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["challenges-pending"] });
    },
  });
}

export function useAcceptChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (challengeId: string) =>
      api.post(`/challenges/accept/${challengeId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["challenges-pending"] });
    },
  });
}

export function useDeclineChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (challengeId: string) =>
      api.post(`/challenges/decline/${challengeId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["challenges-pending"] });
    },
  });
}
