# Football Data Documentation

## Overview
This document describes the standardized football data system for the VerveQ quiz application. The system supports multiple football leagues and various types of data including historical awards, current season statistics, and team performance metrics.

## Data Sources

### Available Leagues
1. **Premier League** - England's top division
2. **La Liga** - Spain's top division  
3. **Bundesliga** - Germany's top division
4. **Serie A** - Italy's top division
5. **Ligue 1** - France's top division
6. **Global Awards** - International competitions (Ballon d'Or)
7. **African Football** - Continental awards

### Data Types

#### 1. Award Historical Data
Long-term historical records of league and international awards.

**Files:**
- `PL_Player_of_the_Season.json` - 30 records (1994-2024)
- `LaLiga_Best_Player.json` - 17 records (2008-2025)
- `SerieA_Footballer_of_the_Year.json` - 28 records (1997-2024)
- `L1_Player_of_the_Year.json` - 32 records (1993-2025)
- `Ballon_d_Or.json` - 69 records (1956-2024)
- `African_Footballer_of_the_Year.json` - 55 records (1970-2024)

**Common Fields:**
- `Season`: Year or season range
- `Player`: Winner's name
- `Nation`: 3-letter country code
- `Age`: Player's age at time of award
- `Squad`: Team(s) information
- `Pos`: Playing position(s)

#### 2. Season Player Statistics
Current season individual player performance metrics.

**Files:**
- `PL_Players_Stats.json` - 67 statistical categories
- `LaLiga_Players_Stats.json` - 79 statistical categories

**Fields:**
- `stat_name`: Type of statistic (e.g., "Goals", "Assists", "xG")
- `player_name`: Player's full name
- `team_name`: Current club
- `stat_value`: Numerical or categorical value

#### 3. Season Team Statistics
Current season team-level performance metrics.

**Files:**
- `La Liga_squad_std_stats.json` - 20 teams

**Key Metrics:**
- Basic: `num_players`, `age`, `poss` (possession)
- Scoring: `gls` (goals), `ast` (assists)
- Advanced: `xG`, `npxG`, `xAG` (expected metrics)
- Progressive: Passing and carrying statistics

#### 4. Top Scorers
Season-by-season leading goalscorers.

**Files:**
- `Bundesliga_Top_Scorers.json` - 3 records (2021-2024)

**Note:** Limited data available for this category.

## Data Schema

### Standardized Classes

#### StandardizedAward
```python
- award_name: str
- winner_name: str  
- year: int
- nationality: Optional[str]
- age: Optional[int]
- team: Optional[str]
- position: Optional[str]
```

#### StandardizedStatistic
```python
- stat_name: str
- stat_value: Any
- player_name: Optional[str]
- team_name: Optional[str]
- season: Optional[str]
```

#### StandardizedTeamStats
```python
- team_name: str
- season: str
- stats: Dict[str, Any]
```

#### StandardizedPlayer
```python
- name: str
- nationality: Optional[str]
- age: Optional[int]
- position: Optional[str]
- team: Optional[str]
- season: Optional[str]
```

## Usage Examples

### Loading League Data
```python
from backend.sports.football_data_loader import FootballDataLoader
from backend.sports.football_data_schema import League

loader = FootballDataLoader()

# Load all Premier League data
pl_data = loader.load_league_data(League.PREMIER_LEAGUE)

# Get recent La Liga award winners
liga_awards = loader.get_award_winners(League.LA_LIGA, last_n_years=5)

# Get top scorers in Premier League
goal_leaders = loader.get_stat_leaders(League.PREMIER_LEAGUE, "Goals")
```

### Data Validation
```python
from backend.sports.football_data_validator import FootballDataValidator

validator = FootballDataValidator()
results = validator.validate_all_files(loader)
report = validator.generate_validation_report(results)
```

## Quiz Question Categories

### 1. Historical Awards
- "Who won the [Award Name] in [Year]?"
- "How many times has [Player] won [Award]?"
- "Which player was the youngest to win [Award]?"

### 2. Current Season Stats
- "Who leads the [League] in [Stat Category]?"
- "What is [Player]'s [Stat] this season?"
- "Which [League] player has the most [Stat]?"

### 3. Team Performance
- "Which [League] team has the highest [Metric]?"
- "What is [Team]'s average possession percentage?"
- "Which team has scored the most goals in [League]?"

### 4. Cross-League Comparisons
- "Which league's Player of the Year is the youngest?"
- "How many Ballon d'Or winners played in [League]?"

## Data Quality Notes

### Strengths
- Comprehensive historical award data
- Detailed current season statistics for major leagues
- Consistent data structure within categories
- Rich metadata (age, nationality, position)

### Limitations
- Bundesliga data limited to 3 recent top scorers only
- Team statistics only available for La Liga
- Player statistics only for Premier League and La Liga
- Some inconsistencies in date formats across files

### Validation Checks
- Required fields presence
- Data type consistency
- Reasonable value ranges (age 16-50)
- Valid season formats
- Nation code format (3 letters)
- Numeric stat values where expected

## Future Enhancements
1. Add more Bundesliga data beyond top scorers
2. Include team statistics for all leagues
3. Add player statistics for Serie A, Ligue 1, Bundesliga
4. Standardize season format across all files
5. Add career statistics for players
6. Include more contextual data (transfer fees, match stats)