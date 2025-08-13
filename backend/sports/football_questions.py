"""
Football question generators for SimpleFootballAdapter
Combines base, advanced, and enhanced question generators
"""

from .football_questions_base import FootballQuestionGeneratorsBase
from .football_questions_advanced import FootballQuestionGeneratorsAdvanced
from .football_questions_enhanced import FootballQuestionGeneratorsEnhanced


class FootballQuestionGenerators(FootballQuestionGeneratorsBase, FootballQuestionGeneratorsAdvanced, FootballQuestionGeneratorsEnhanced):
    """Combined question generation methods for football quiz"""
    pass