"""
Basic performance benchmarks for VerveQ Platform
Simple baselines following CLAUDE.md principles (<100 lines)
"""
import pytest
from httpx import AsyncClient
import time


class TestBasicPerformance:
    """Basic performance benchmarks for critical endpoints"""
    
    @pytest.mark.benchmark
    @pytest.mark.asyncio
    async def test_health_endpoint_speed(self, client: AsyncClient, benchmark):
        """Health endpoint should respond quickly"""
        async def health_request():
            return await client.get("/health")
        
        response = await benchmark(health_request)
        assert response.status_code == 200
        # Health checks should be under 50ms
        assert benchmark.stats.mean < 0.05
    
    @pytest.mark.benchmark
    @pytest.mark.asyncio
    async def test_quiz_question_speed(self, client: AsyncClient, benchmark):
        """Quiz question endpoint baseline performance"""
        async def quiz_request():
            return await client.get("/football/quiz/question")
        
        response = await benchmark(quiz_request)
        assert response.status_code == 200
        # Quiz questions should be under 200ms
        assert benchmark.stats.mean < 0.2
    
    @pytest.mark.benchmark
    @pytest.mark.asyncio
    async def test_survival_initials_speed(self, client: AsyncClient, benchmark):
        """Survival initials endpoint baseline performance"""
        async def survival_request():
            return await client.get("/football/survival/initials")
        
        response = await benchmark(survival_request)
        assert response.status_code == 200
        # Survival data should be under 100ms
        assert benchmark.stats.mean < 0.1
    
    @pytest.mark.benchmark
    @pytest.mark.asyncio
    async def test_achievements_list_speed(self, client: AsyncClient, benchmark):
        """Achievements listing performance"""
        async def achievements_request():
            return await client.get("/achievements/")
        
        response = await benchmark(achievements_request)
        assert response.status_code == 200
        # Database queries should be under 100ms
        assert benchmark.stats.mean < 0.1
    
    @pytest.mark.benchmark
    @pytest.mark.asyncio 
    async def test_leaderboard_speed(self, client: AsyncClient, benchmark):
        """Leaderboard endpoint performance"""
        async def leaderboard_request():
            return await client.get("/leaderboards/global")
        
        response = await benchmark(leaderboard_request)
        assert response.status_code == 200
        # Leaderboard queries should be under 150ms
        assert benchmark.stats.mean < 0.15
    
    @pytest.mark.benchmark
    @pytest.mark.asyncio
    async def test_session_creation_speed(self, client: AsyncClient, benchmark):
        """Session creation performance"""
        async def session_request():
            return await client.post("/football/quiz/session")
        
        response = await benchmark(session_request)
        assert response.status_code == 200
        # Session creation should be under 50ms
        assert benchmark.stats.mean < 0.05