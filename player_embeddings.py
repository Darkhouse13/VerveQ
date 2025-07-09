import json
import os
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from typing import List, Dict, Any, Optional
import logging
from pathlib import Path # Import Path

# Conditional import for ML libraries
try:
    from sentence_transformers import SentenceTransformer
    ML_LIBS_AVAILABLE = True
except ImportError:
    logging.warning("Sentence-transformers not found. ML-based embeddings will be unavailable.")
    ML_LIBS_AVAILABLE = False

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class PlayerEmbeddingSystem:
    def __init__(self, config_path: str = 'embedding_config.json', data_handler: Any = None):
        # Resolve config_path relative to the current working directory
        self.config_path = Path(config_path)
        self.config = self._load_config()
        self.data_handler = data_handler # This should be an instance of Data.py's JSONDataHandler
        self.player_embeddings: Dict[str, np.ndarray] = {}
        self.team_embeddings: Dict[str, np.ndarray] = {}
        self.ml_model: Optional[SentenceTransformer] = None
        self.cache_dir = self.config.get('cache_dir', 'cache/embeddings')
        os.makedirs(self.cache_dir, exist_ok=True)
        self._load_ml_model()

    def _load_config(self) -> Dict[str, Any]:
        """Loads the embedding configuration from a JSON file."""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            logger.error(f"Config file not found at {self.config_path}. Using default config.")
            return {
                "rule_based_weights": {
                    "position": 0.2, "era": 0.15, "nationality": 0.15,
                    "team": 0.1, "performance": 0.2, "achievements": 0.2
                },
                "ml_model_path": "models/player_embedding_model",
                "cache_dir": "cache/embeddings",
                "embedding_dimension": 128,
                "update_frequency_hours": 24
            }
        except json.JSONDecodeError:
            logger.error(f"Error decoding JSON from {self.config_path}. Using default config.")
            return {
                "rule_based_weights": {
                    "position": 0.2, "era": 0.15, "nationality": 0.15,
                    "team": 0.1, "performance": 0.2, "achievements": 0.2
                },
                "ml_model_path": "models/player_embedding_model",
                "cache_dir": "cache/embeddings",
                "embedding_dimension": 128,
                "update_frequency_hours": 24
            }

    def _load_ml_model(self):
        """Loads the SentenceTransformer model if ML libraries are available."""
        if ML_LIBS_AVAILABLE:
            model_path = self.config.get('ml_model_path', 'sentence-transformers/all-MiniLM-L6-v2')
            try:
                self.ml_model = SentenceTransformer(model_path)
                logger.info(f"ML model loaded from {model_path}")
            except Exception as e:
                logger.error(f"Failed to load ML model from {model_path}: {e}")
                self.ml_model = None
        else:
            logger.info("ML model not loaded as ML libraries are unavailable.")

    def _get_player_data(self) -> Dict[str, Any]:
        """Fetches all player data using the data handler."""
        if self.data_handler:
            # Assuming data_handler has a method to get all player data
            # The get_all_players method in Data.py now returns records with 'Player' key
            all_players = self.data_handler.get_all_players()
            return {player['Player']: player for player in all_players if 'Player' in player}
        logger.error("Data handler not provided or not properly initialized.")
        return {}

    def _get_team_data(self) -> Dict[str, Any]:
        """Fetches all team data using the data handler."""
        if self.data_handler:
            # The get_all_teams method in Data.py now returns records with 'team_name' key
            all_teams = self.data_handler.get_all_teams()
            return {team['team_name']: team for team in all_teams if 'team_name' in team}
        logger.error("Data handler not provided or not properly initialized.")
        return {}

    def _rule_based_player_embedding(self, player: Dict[str, Any]) -> np.ndarray:
        """Generates a rule-based embedding for a single player."""
        weights = self.config['rule_based_weights']
        embedding_dim = self.config['embedding_dimension']
        embedding = np.zeros(embedding_dim)

        # Example rule-based features (simplified for demonstration)
        # In a real scenario, these would be more sophisticated,
        # involving mapping categorical features to numerical vectors
        # and normalizing numerical features.

        # Position (categorical)
        position_map = {'Goalkeeper': 0, 'Defender': 1, 'Midfielder': 2, 'Forward': 3}
        pos_val = position_map.get(player.get('Position', 'Unknown'), -1) # Use 'Position'
        if pos_val != -1:
            embedding[0] += weights['position'] * pos_val # Simple mapping

        # Era (numerical - e.g., career start year)
        # Assuming 'Season' is the start year for awards, or 'career_start_year' for stats
        season_str = player.get('Season', str(player.get('career_start_year', 2000)))
        try:
            start_year = int(season_str.split('-')[0]) # Extract year from 'YYYY-YY' format
        except ValueError:
            start_year = int(season_str) # Fallback if it's just a year
        embedding[1] += weights['era'] * (start_year / 2000) # Normalize roughly

        # Nationality (categorical - simple hash or one-hot encoding)
        nationality = player.get('Nationality', 'Unknown') # Use 'Nationality'
        embedding[2] += weights['nationality'] * (hash(nationality) % 100 / 100.0) # Simple hash

        # Performance (numerical - Goals, Appearances)
        goals = player.get('Goals', 0) # Use 'Goals'
        appearances = player.get('Appearances', 0) # Use 'Appearances'
        embedding[3] += weights['performance'] * (goals / 100.0)
        embedding[4] += weights['performance'] * (appearances / 500.0)

        # Achievements (numerical - Trophies, individual_awards)
        trophies = player.get('Trophies', 0) # Use 'Trophies'
        awards = player.get('individual_awards', 0) # This might need to be extracted from award data
        embedding[5] += weights['achievements'] * (trophies / 10.0)
        embedding[6] += weights['achievements'] * (awards / 5.0)

        # Team features (e.g., average team quality, leagues played)
        # This would require more complex data lookup
        # For now, a placeholder
        embedding[7] += weights['team'] * 0.5 # Placeholder

        # Normalize the embedding
        norm = np.linalg.norm(embedding)
        return embedding / norm if norm != 0 else embedding

    def _ml_based_player_embedding(self, player: Dict[str, Any]) -> Optional[np.ndarray]:
        """Generates an ML-based embedding for a single player using SentenceTransformer."""
        if not ML_LIBS_AVAILABLE or self.ml_model is None:
            logger.warning("ML model not available for ML-based embeddings.")
            return None

        # Combine relevant textual and numerical features into a single string
        # This string will be fed to the SentenceTransformer
        text_features = [
            player.get('Player', ''), # Use 'Player' key
            player.get('Position', ''),
            player.get('Nationality', ''),
            player.get('Club', ''),
            player.get('description', '') # Assuming player data has a description field
        ]
        # Add numerical features as text
        numerical_features = [
            f"goals: {player.get('Goals', 0)}", # Use 'Goals' key
            f"appearances: {player.get('Appearances', 0)}", # Use 'Appearances' key
            f"career_start: {player.get('career_start_year', '')}",
            f"trophies: {player.get('Trophies', 0)}", # Use 'Trophies' key
            f"awards: {player.get('individual_awards', 0)}"
        ]
        combined_text = " ".join(filter(None, text_features + numerical_features))

        try:
            embedding = self.ml_model.encode(combined_text, convert_to_numpy=True)
            return embedding
        except Exception as e:
            logger.error(f"Error generating ML embedding for player {player.get('Player')}: {e}") # Use 'Player' key
            return None

    def create_player_embeddings(self, strategy: str = 'rule_based'):
        """
        Generates embeddings for all players based on the specified strategy.
        Caches embeddings to disk.
        """
        logger.info(f"Creating player embeddings using {strategy} strategy...")
        players_data = self._get_player_data()
        if not players_data:
            logger.error("No player data available to create embeddings.")
            return

        new_embeddings: Dict[str, np.ndarray] = {}
        for player_name, player_info in players_data.items():
            if strategy == 'rule_based':
                embedding = self._rule_based_player_embedding(player_info)
            elif strategy == 'ml_based':
                embedding = self._ml_based_player_embedding(player_info)
            else:
                logger.warning(f"Unknown embedding strategy: {strategy}. Skipping player {player_name}.")
                continue

            if embedding is not None:
                new_embeddings[player_name] = embedding
        
        self.player_embeddings = new_embeddings
        self._save_embeddings_to_cache('player_embeddings.json', self.player_embeddings)
        logger.info(f"Successfully created and cached {len(self.player_embeddings)} player embeddings.")

    def _rule_based_team_embedding(self, team: Dict[str, Any]) -> np.ndarray:
        """Generates a rule-based embedding for a single team."""
        weights = self.config['rule_based_weights'] # Reusing player weights for simplicity
        embedding_dim = self.config['embedding_dimension']
        embedding = np.zeros(embedding_dim)

        # Example team features
        # League quality (numerical)
        league_quality = team.get('league_quality', 0.5) # Placeholder
        embedding[0] += weights['team'] * league_quality

        # Number of trophies (numerical)
        team_trophies = team.get('trophies', 0)
        embedding[1] += weights['achievements'] * (team_trophies / 20.0)

        # Average player quality (numerical)
        avg_player_quality = team.get('avg_player_quality', 0.5) # Placeholder
        embedding[2] += weights['performance'] * avg_player_quality

        norm = np.linalg.norm(embedding)
        return embedding / norm if norm != 0 else embedding

    def create_team_embeddings(self, strategy: str = 'rule_based'):
        """
        Generates embeddings for all teams based on the specified strategy.
        Caches embeddings to disk.
        """
        logger.info(f"Creating team embeddings using {strategy} strategy...")
        teams_data = self._get_team_data()
        if not teams_data:
            logger.error("No team data available to create embeddings.")
            return

        new_embeddings: Dict[str, np.ndarray] = {}
        for team_name, team_info in teams_data.items():
            if strategy == 'rule_based':
                embedding = self._rule_based_team_embedding(team_info)
            elif strategy == 'ml_based':
                # ML-based team embedding would require a different approach,
                # perhaps aggregating player embeddings or using team descriptions.
                # For now, we'll just use rule-based or skip.
                logger.warning("ML-based team embeddings not yet implemented. Using rule-based.")
                embedding = self._rule_based_team_embedding(team_info)
            else:
                logger.warning(f"Unknown embedding strategy: {strategy}. Skipping team {team_name}.")
                continue

            if embedding is not None:
                new_embeddings[team_name] = embedding
        
        self.team_embeddings = new_embeddings
        self._save_embeddings_to_cache('team_embeddings.json', self.team_embeddings)
        logger.info(f"Successfully created and cached {len(self.team_embeddings)} team embeddings.")

    def _load_embeddings_from_cache(self, filename: str) -> Dict[str, np.ndarray]:
        """Loads embeddings from a JSON file in the cache directory."""
        filepath = os.path.join(self.cache_dir, filename)
        if os.path.exists(filepath):
            try:
                with open(filepath, 'r') as f:
                    loaded_data = json.load(f)
                    # Convert lists back to numpy arrays
                    return {k: np.array(v) for k, v in loaded_data.items()}
            except json.JSONDecodeError as e:
                logger.error(f"Error decoding JSON from cache file {filepath}: {e}")
            except Exception as e:
                logger.error(f"Error loading embeddings from cache file {filepath}: {e}")
        return {}

    def _save_embeddings_to_cache(self, filename: str, embeddings: Dict[str, np.ndarray]):
        """Saves embeddings to a JSON file in the cache directory."""
        filepath = os.path.join(self.cache_dir, filename)
        try:
            # Convert numpy arrays to lists for JSON serialization
            serializable_embeddings = {k: v.tolist() for k, v in embeddings.items()}
            with open(filepath, 'w') as f:
                json.dump(serializable_embeddings, f, indent=4)
        except Exception as e:
            logger.error(f"Error saving embeddings to cache file {filepath}: {e}")

    def load_all_embeddings(self):
        """Loads all player and team embeddings from cache."""
        self.player_embeddings = self._load_embeddings_from_cache('player_embeddings.json')
        self.team_embeddings = self._load_embeddings_from_cache('team_embeddings.json')
        logger.info(f"Loaded {len(self.player_embeddings)} player embeddings and {len(self.team_embeddings)} team embeddings from cache.")

    def get_similarity_score(self, entity1_embedding: np.ndarray, entity2_embedding: np.ndarray) -> float:
        """Calculates cosine similarity between two embeddings."""
        if entity1_embedding.size == 0 or entity2_embedding.size == 0:
            return 0.0 # Or raise an error, depending on desired behavior
        # Reshape for sklearn's cosine_similarity if they are 1D arrays
        vec1 = entity1_embedding.reshape(1, -1)
        vec2 = entity2_embedding.reshape(1, -1)
        return cosine_similarity(vec1, vec2)[0][0]

    def find_similar_players(self, player_name: str, top_n: int = 5, strategy: str = 'rule_based') -> List[Dict[str, Any]]:
        """
        Finds players similar to the given player based on their embeddings.
        If embeddings are not pre-calculated, they will be generated.
        """
        if not self.player_embeddings:
            self.create_player_embeddings(strategy=strategy)
            if not self.player_embeddings: # Check again if creation failed
                logger.error("Could not create player embeddings. Cannot find similar players.")
                return []

        target_embedding = self.player_embeddings.get(player_name)
        if target_embedding is None:
            logger.warning(f"Embedding for player '{player_name}' not found.")
            return []

        similarities = []
        for other_player_name, other_embedding in self.player_embeddings.items():
            if other_player_name == player_name:
                continue
            score = self.get_similarity_score(target_embedding, other_embedding)
            similarities.append({'player_name': other_player_name, 'similarity': score})

        similarities.sort(key=lambda x: x['similarity'], reverse=True)
        return similarities[:top_n]

    def find_similar_teams(self, team_name: str, top_n: int = 5, strategy: str = 'rule_based') -> List[Dict[str, Any]]:
        """
        Finds teams similar to the given team based on their embeddings.
        If embeddings are not pre-calculated, they will be generated.
        """
        if not self.team_embeddings:
            self.create_team_embeddings(strategy=strategy)
            if not self.team_embeddings: # Check again if creation failed
                logger.error("Could not create team embeddings. Cannot find similar teams.")
                return []

        target_embedding = self.team_embeddings.get(team_name)
        if target_embedding is None:
            logger.warning(f"Embedding for team '{team_name}' not found.")
            return []

        similarities = []
        for other_team_name, other_embedding in self.team_embeddings.items():
            if other_team_name == team_name:
                continue
            score = self.get_similarity_score(target_embedding, other_embedding)
            similarities.append({'team_name': other_team_name, 'similarity': score})

        similarities.sort(key=lambda x: x['similarity'], reverse=True)
        return similarities[:top_n]

    def update_embeddings(self, entity_type: str = 'all', strategy: str = 'rule_based'):
        """
        Refreshes embeddings for players, teams, or both.
        entity_type: 'players', 'teams', or 'all'
        """
        logger.info(f"Updating {entity_type} embeddings with {strategy} strategy...")
        if entity_type == 'players' or entity_type == 'all':
            self.create_player_embeddings(strategy=strategy)
        if entity_type == 'teams' or entity_type == 'all':
            self.create_team_embeddings(strategy=strategy)
        logger.info("Embeddings update complete.")

# Example Usage (for testing purposes, assuming a mock DataHandler)
if __name__ == "__main__":
    class MockDataHandler:
        def get_all_players(self):
            return [
                {"Player": "Lionel Messi", "Position": "Forward", "Nationality": "Argentina",
                 "Season": "2004-05", "Goals": 800, "Appearances": 1000, "Trophies": 40,
                 "individual_awards": 7, "Club": "Inter Miami", "description": "One of the greatest footballers of all time."},
                {"Player": "Cristiano Ronaldo", "Position": "Forward", "Nationality": "Portugal",
                 "Season": "2002-03", "Goals": 850, "Appearances": 1100, "Trophies": 35,
                 "individual_awards": 5, "Club": "Al Nassr", "description": "Prolific goalscorer and multiple Ballon d'Or winner."},
                {"Player": "Neymar Jr.", "Position": "Forward", "Nationality": "Brazil",
                 "Season": "2009-10", "Goals": 350, "Appearances": 600, "Trophies": 25,
                 "individual_awards": 0, "Club": "Al Hilal", "description": "Skilful Brazilian forward."},
                {"Player": "Virgil van Dijk", "Position": "Defender", "Nationality": "Netherlands",
                 "Season": "2011-12", "Goals": 50, "Appearances": 400, "Trophies": 10,
                 "individual_awards": 0, "Club": "Liverpool", "description": "Dominant centre-back."},
                {"Player": "Luka Modric", "Position": "Midfielder", "Nationality": "Croatia",
                 "Season": "2003-04", "Goals": 100, "Appearances": 700, "Trophies": 20,
                 "individual_awards": 1, "Club": "Real Madrid", "description": "Elegant central midfielder."},
                {"Player": "Manuel Neuer", "Position": "Goalkeeper", "Nationality": "Germany",
                 "Season": "2004-05", "Goals": 0, "Appearances": 650, "Trophies": 30,
                 "individual_awards": 0, "Club": "Bayern Munich", "description": "Modern sweeper-keeper."}
            ]

        def get_all_teams(self):
            return [
                {"team_name": "Real Madrid", "league_quality": 0.9, "trophies": 100, "avg_player_quality": 0.8},
                {"team_name": "FC Barcelona", "league_quality": 0.85, "trophies": 90, "avg_player_quality": 0.75},
                {"team_name": "Liverpool", "league_quality": 0.8, "trophies": 60, "avg_player_quality": 0.7},
                {"team_name": "Bayern Munich", "league_quality": 0.95, "trophies": 110, "avg_player_quality": 0.85}
            ]

    mock_data_handler = MockDataHandler()
    embedding_system = PlayerEmbeddingSystem(data_handler=mock_data_handler)

    # Test Rule-based embeddings
    print("\n--- Testing Rule-based Embeddings ---")
    embedding_system.create_player_embeddings(strategy='rule_based')
    similar_messi_rb = embedding_system.find_similar_players("Lionel Messi", top_n=3, strategy='rule_based')
    print(f"Players similar to Messi (Rule-based): {similar_messi_rb}")

    similar_vvd_rb = embedding_system.find_similar_players("Virgil van Dijk", top_n=3, strategy='rule_based')
    print(f"Players similar to Virgil van Dijk (Rule-based): {similar_vvd_rb}")

    embedding_system.create_team_embeddings(strategy='rule_based')
    similar_real_madrid_rb = embedding_system.find_similar_teams("Real Madrid", top_n=3, strategy='rule_based')
    print(f"Teams similar to Real Madrid (Rule-based): {similar_real_madrid_rb}")

    # Test ML-based embeddings (if available)
    if ML_LIBS_AVAILABLE:
        print("\n--- Testing ML-based Embeddings ---")
        embedding_system.create_player_embeddings(strategy='ml_based')
        similar_messi_ml = embedding_system.find_similar_players("Lionel Messi", top_n=3, strategy='ml_based')
        print(f"Players similar to Messi (ML-based): {similar_messi_ml}")
    else:
        print("\n--- Skipping ML-based Embeddings (Libraries not available) ---")

    # Test loading from cache
    print("\n--- Testing Cache Loading ---")
    new_embedding_system = PlayerEmbeddingSystem(data_handler=mock_data_handler)
    new_embedding_system.load_all_embeddings()
    print(f"Loaded {len(new_embedding_system.player_embeddings)} player embeddings from cache.")
    print(f"Loaded {len(new_embedding_system.team_embeddings)} team embeddings from cache.")

    # Verify similarity with loaded embeddings
    if "Lionel Messi" in new_embedding_system.player_embeddings:
        similar_messi_loaded = new_embedding_system.find_similar_players("Lionel Messi", top_n=3, strategy='rule_based') # Strategy doesn't matter for finding, only for creating
        print(f"Players similar to Messi (Loaded from cache): {similar_messi_loaded}")
