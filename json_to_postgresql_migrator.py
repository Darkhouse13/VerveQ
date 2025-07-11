#!/usr/bin/env python3
"""
FootQuizz JSON to PostgreSQL Migration Script

This script migrates data from the existing JSON-based storage system
to the new PostgreSQL database schema.

Usage:
    python json_to_postgresql_migrator.py --database-url postgresql://user:pass@host:port/dbname
    python json_to_postgresql_migrator.py --config-file migration_config.json
    python json_to_postgresql_migrator.py --dry-run  # Test without making changes
"""

import json
import os
import sys
import argparse
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
import re

import psycopg
from psycopg.rows import dict_row
import pandas as pd
from sqlalchemy import create_engine, text, MetaData, Table
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError

# Import existing data handlers
from Data import JSONDataHandler
from SurvivalDataHandler import SurvivalDataHandler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('migration.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


class MigrationError(Exception):
    """Custom exception for migration errors"""
    pass


class JSONToPostgreSQLMigrator:
    """
    Main migration class that handles the transformation of JSON data
    to PostgreSQL database format.
    """

    def __init__(self, database_url: str, dry_run: bool = False):
        """
        Initialize the migrator.

        Args:
            database_url: PostgreSQL connection string
            dry_run: If True, perform validation without making changes
        """
        self.database_url = database_url
        self.dry_run = dry_run
        self.engine = None
        self.session = None

        # Data handlers
        self.json_handler = None
        self.survival_handler = None

        # Migration statistics
        self.stats = {
            'players_migrated': 0,
            'teams_migrated': 0,
            'awards_migrated': 0,
            'statistics_migrated': 0,
            'tournaments_migrated': 0,
            'survival_players_migrated': 0,
            'errors': []
        }

        # Name normalization cache
        self.normalized_names = {}

        logger.info(f"Migrator initialized (dry_run={dry_run})")

    def connect_database(self):
        """Establish database connection"""
        try:
            self.engine = create_engine(self.database_url, echo=False)
            Session = sessionmaker(bind=self.engine)
            self.session = Session()

            # Test connection
            with self.engine.connect() as conn:
                result = conn.execute(text("SELECT version()"))
                version = result.fetchone()[0]
                logger.info(f"Connected to PostgreSQL: {version}")

        except Exception as e:
            raise MigrationError(f"Failed to connect to database: {e}")

    def initialize_data_handlers(self):
        """Initialize JSON data handlers"""
        try:
            # Initialize JSON data handler
            self.json_handler = JSONDataHandler()
            logger.info("JSON data handler initialized")

            # Initialize survival data handler
            self.survival_handler = SurvivalDataHandler()
            if not self.survival_handler.is_loaded():
                self.survival_handler.ensure_loaded()
            logger.info("Survival data handler initialized")

        except Exception as e:
            raise MigrationError(f"Failed to initialize data handlers: {e}")

    def normalize_name(self, name: str) -> str:
        """
        Normalize player/team names for consistent matching.

        Args:
            name: Original name

        Returns:
            Normalized name for database storage
        """
        if name in self.normalized_names:
            return self.normalized_names[name]

        # Basic normalization
        normalized = name.strip()
        normalized = re.sub(r'\s+', ' ', normalized)  # Multiple spaces to single
        normalized = re.sub(r'[^\w\s\-\']', '', normalized)  # Remove special chars except dash and apostrophe

        self.normalized_names[name] = normalized
        return normalized

    def get_or_create_sport(self, sport_name: str) -> int:
        """Get or create sport record and return ID"""
        if self.dry_run:
            return 1  # Mock ID for dry run

        try:
            # Check if sport exists
            result = self.session.execute(
                text("SELECT id FROM sports WHERE name = :name"),
                {"name": sport_name}
            ).fetchone()

            if result:
                return result[0]

            # Create new sport
            result = self.session.execute(
                text("INSERT INTO sports (name, display_name) VALUES (:name, :display_name) RETURNING id"),
                {"name": sport_name, "display_name": sport_name.title()}
            )
            sport_id = result.fetchone()[0]
            self.session.commit()

            logger.info(f"Created sport: {sport_name} (ID: {sport_id})")
            return sport_id

        except Exception as e:
            self.session.rollback()
            raise MigrationError(f"Failed to get/create sport {sport_name}: {e}")

    def get_or_create_team(self, team_name: str, sport_id: int, country: str = None) -> int:
        """Get or create team record and return ID"""
        if self.dry_run:
            return 1  # Mock ID for dry run

        normalized_name = self.normalize_name(team_name)

        try:
            # Check if team exists
            result = self.session.execute(
                text("SELECT id FROM teams WHERE sport_id = :sport_id AND normalized_name = :name"),
                {"sport_id": sport_id, "name": normalized_name}
            ).fetchone()

            if result:
                return result[0]

            # Create new team
            result = self.session.execute(
                text("""
                    INSERT INTO teams (name, display_name, sport_id, country)
                    VALUES (:name, :display_name, :sport_id, :country)
                    RETURNING id
                """),
                {
                    "name": normalized_name,
                    "display_name": team_name,
                    "sport_id": sport_id,
                    "country": country
                }
            )
            team_id = result.fetchone()[0]
            self.session.commit()

            logger.debug(f"Created team: {team_name} (ID: {team_id})")
            self.stats['teams_migrated'] += 1
            return team_id

        except Exception as e:
            self.session.rollback()
            raise MigrationError(f"Failed to get/create team {team_name}: {e}")

    def get_or_create_player(self, player_name: str, sport_id: int,
                           nationality: str = None, positions: List[str] = None) -> int:
        """Get or create player record and return ID"""
        if self.dry_run:
            return 1  # Mock ID for dry run

        normalized_name = self.normalize_name(player_name)

        try:
            # Check if player exists
            result = self.session.execute(
                text("SELECT id FROM players WHERE sport_id = :sport_id AND normalized_name = :name"),
                {"sport_id": sport_id, "name": normalized_name}
            ).fetchone()

            if result:
                return result[0]

            # Create new player
            result = self.session.execute(
                text("""
                    INSERT INTO players (name, normalized_name, sport_id, nationality, positions)
                    VALUES (:name, :normalized_name, :sport_id, :nationality, :positions)
                    RETURNING id
                """),
                {
                    "name": player_name,
                    "normalized_name": normalized_name,
                    "sport_id": sport_id,
                    "nationality": nationality,
                    "positions": positions or []
                }
            )
            player_id = result.fetchone()[0]
            self.session.commit()

            logger.debug(f"Created player: {player_name} (ID: {player_id})")
            self.stats['players_migrated'] += 1
            return player_id

        except Exception as e:
            self.session.rollback()
            raise MigrationError(f"Failed to get/create player {player_name}: {e}")

    def migrate_awards(self):
        """Migrate award data from JSON to PostgreSQL"""
        logger.info("Starting awards migration...")

        football_sport_id = self.get_or_create_sport('football')
        tennis_sport_id = self.get_or_create_sport('tennis')

        # Migrate football awards
        for competition_name, award_data in self.json_handler.award_data.items():
            logger.info(f"Migrating awards from {competition_name}...")

            try:
                # Get or create award type
                award_type_name = competition_name.replace('.json', '').replace('_', ' ').title()

                if not self.dry_run:
                    # Create award type
                    result = self.session.execute(
                        text("""
                            INSERT INTO award_types (name, display_name, sport_id)
                            VALUES (:name, :display_name, :sport_id)
                            ON CONFLICT (sport_id, name) DO NOTHING
                            RETURNING id
                        """),
                        {
                            "name": competition_name.replace('.json', ''),
                            "display_name": award_type_name,
                            "sport_id": football_sport_id
                        }
                    )

                    # Get award type ID
                    award_type_result = self.session.execute(
                        text("SELECT id FROM award_types WHERE sport_id = :sport_id AND name = :name"),
                        {"sport_id": football_sport_id, "name": competition_name.replace('.json', '')}
                    ).fetchone()

                    if not award_type_result:
                        logger.error(f"Failed to create/find award type for {competition_name}")
                        continue

                    award_type_id = award_type_result[0]

                # Process each award record
                for record in award_data:
                    try:
                        # Extract player info
                        player_name = record.get('Player', '')
                        season = record.get('Season', '')
                        nationality = record.get('Nation', '')
                        age = record.get('Age')
                        squad = record.get('Squad', '')
                        positions = record.get('Pos', '').split(',') if record.get('Pos') else []

                        if not player_name or not season:
                            logger.warning(f"Skipping incomplete award record: {record}")
                            continue

                        # Create player
                        player_id = self.get_or_create_player(
                            player_name, football_sport_id, nationality, positions
                        )

                        # Create team if squad is specified
                        team_id = None
                        if squad:
                            team_id = self.get_or_create_team(squad, football_sport_id)

                        # Create award record
                        if not self.dry_run:
                            self.session.execute(
                                text("""
                                    INSERT INTO player_awards
                                    (player_id, award_type_id, season, team_id, age, additional_data)
                                    VALUES (:player_id, :award_type_id, :season, :team_id, :age, :additional_data)
                                    ON CONFLICT DO NOTHING
                                """),
                                {
                                    "player_id": player_id,
                                    "award_type_id": award_type_id,
                                    "season": season,
                                    "team_id": team_id,
                                    "age": int(age) if age and age.isdigit() else None,
                                    "additional_data": json.dumps(record)
                                }
                            )

                        self.stats['awards_migrated'] += 1

                    except Exception as e:
                        error_msg = f"Error processing award record {record}: {e}"
                        logger.error(error_msg)
                        self.stats['errors'].append(error_msg)

                if not self.dry_run:
                    self.session.commit()

            except Exception as e:
                if not self.dry_run:
                    self.session.rollback()
                error_msg = f"Error migrating awards from {competition_name}: {e}"
                logger.error(error_msg)
                self.stats['errors'].append(error_msg)

        logger.info(f"Awards migration completed. Migrated: {self.stats['awards_migrated']}")

    def migrate_statistics(self):
        """Migrate statistics data from JSON to PostgreSQL"""
        logger.info("Starting statistics migration...")

        football_sport_id = self.get_or_create_sport('football')

        # Migrate player statistics
        for competition_name, stats_data in self.json_handler.stats_data.items():
            logger.info(f"Migrating player statistics from {competition_name}...")

            try:
                # Process each statistic record
                for record in stats_data:
                    try:
                        stat_name = record.get('stat_name', '')
                        player_name = record.get('player_name', '')
                        team_name = record.get('team_name', '')
                        stat_value = record.get('stat_value', '')

                        if not all([stat_name, player_name, stat_value]):
                            logger.warning(f"Skipping incomplete stat record: {record}")
                            continue

                        # Create or get statistic type
                        if not self.dry_run:
                            self.session.execute(
                                text("""
                                    INSERT INTO statistic_types (name, display_name, sport_id, data_type)
                                    VALUES (:name, :display_name, :sport_id, :data_type)
                                    ON CONFLICT (sport_id, name) DO NOTHING
                                """),
                                {
                                    "name": stat_name.lower().replace(' ', '_'),
                                    "display_name": stat_name,
                                    "sport_id": football_sport_id,
                                    "data_type": 'numeric' if self._is_numeric(stat_value) else 'text'
                                }
                            )

                            # Get statistic type ID
                            stat_type_result = self.session.execute(
                                text("SELECT id FROM statistic_types WHERE sport_id = :sport_id AND name = :name"),
                                {"sport_id": football_sport_id, "name": stat_name.lower().replace(' ', '_')}
                            ).fetchone()

                            if not stat_type_result:
                                logger.error(f"Failed to create/find statistic type for {stat_name}")
                                continue

                            stat_type_id = stat_type_result[0]

                        # Create player
                        player_id = self.get_or_create_player(player_name, football_sport_id)

                        # Create team if specified
                        team_id = None
                        if team_name:
                            team_id = self.get_or_create_team(team_name, football_sport_id)

                        # Create statistic record
                        if not self.dry_run:
                            numeric_value = None
                            text_value = None

                            if self._is_numeric(stat_value):
                                numeric_value = float(stat_value.strip())
                            else:
                                text_value = stat_value.strip()

                            self.session.execute(
                                text("""
                                    INSERT INTO player_statistics
                                    (player_id, statistic_type_id, team_id, numeric_value, text_value)
                                    VALUES (:player_id, :statistic_type_id, :team_id, :numeric_value, :text_value)
                                    ON CONFLICT DO NOTHING
                                """),
                                {
                                    "player_id": player_id,
                                    "statistic_type_id": stat_type_id,
                                    "team_id": team_id,
                                    "numeric_value": numeric_value,
                                    "text_value": text_value
                                }
                            )

                        self.stats['statistics_migrated'] += 1

                    except Exception as e:
                        error_msg = f"Error processing statistic record {record}: {e}"
                        logger.error(error_msg)
                        self.stats['errors'].append(error_msg)

                if not self.dry_run:
                    self.session.commit()

            except Exception as e:
                if not self.dry_run:
                    self.session.rollback()
                error_msg = f"Error migrating statistics from {competition_name}: {e}"
                logger.error(error_msg)
                self.stats['errors'].append(error_msg)

        logger.info(f"Statistics migration completed. Migrated: {self.stats['statistics_migrated']}")

    def _is_numeric(self, value: str) -> bool:
        """Check if a string value represents a number"""
        try:
            float(value.strip())
            return True
        except (ValueError, AttributeError):
            return False

    def migrate_survival_data(self):
        """Migrate survival mode data from JSON to PostgreSQL"""
        logger.info("Starting survival data migration...")

        football_sport_id = self.get_or_create_sport('football')

        try:
            # Get all players from survival data
            all_players = self.survival_handler.get_all_players()
            logger.info(f"Found {len(all_players)} survival players to migrate")

            for player_name in all_players:
                try:
                    # Create player record
                    player_id = self.get_or_create_player(player_name, football_sport_id)

                    # Extract initials
                    initials = ''.join([word[0].upper() for word in player_name.split() if word])

                    # Create survival player record
                    if not self.dry_run:
                        self.session.execute(
                            text("""
                                INSERT INTO survival_players (player_id, initials)
                                VALUES (:player_id, :initials)
                                ON CONFLICT (player_id) DO NOTHING
                            """),
                            {
                                "player_id": player_id,
                                "initials": initials
                            }
                        )

                    self.stats['survival_players_migrated'] += 1

                except Exception as e:
                    error_msg = f"Error processing survival player {player_name}: {e}"
                    logger.error(error_msg)
                    self.stats['errors'].append(error_msg)

            if not self.dry_run:
                self.session.commit()

        except Exception as e:
            if not self.dry_run:
                self.session.rollback()
            error_msg = f"Error migrating survival data: {e}"
            logger.error(error_msg)
            self.stats['errors'].append(error_msg)

        logger.info(f"Survival data migration completed. Migrated: {self.stats['survival_players_migrated']}")

    def migrate_tennis_data(self):
        """Migrate tennis data from processed_tennis directory"""
        logger.info("Starting tennis data migration...")
        
        tennis_sport_id = self.get_or_create_sport('tennis')
        processed_tennis_dir = Path("processed_tennis")
        
        if not processed_tennis_dir.exists():
            logger.warning("processed_tennis directory not found, skipping tennis data migration")
            return
        
        try:
            # Process tennis awards
            tennis_awards_file = processed_tennis_dir / "tennis_awards.json"
            if tennis_awards_file.exists():
                logger.info("Migrating tennis awards...")
                with open(tennis_awards_file, 'r') as f:
                    tennis_awards = json.load(f)
                
                for award_data in tennis_awards:
                    try:
                        # Create award type if not exists
                        award_type_name = award_data.get('award_type', 'Tennis Award')
                        
                        if not self.dry_run:
                            # Create award type
                            result = self.session.execute(
                                text("""
                                    INSERT INTO award_types (name, display_name, sport_id)
                                    VALUES (:name, :display_name, :sport_id)
                                    ON CONFLICT (name, sport_id) DO UPDATE SET
                                        display_name = EXCLUDED.display_name
                                    RETURNING id
                                """),
                                {
                                    "name": award_type_name.lower().replace(' ', '_'),
                                    "display_name": award_type_name,
                                    "sport_id": tennis_sport_id
                                }
                            ).fetchone()
                            award_type_id = result[0]
                        else:
                            award_type_id = 1  # Mock ID for dry run
                        
                        # Create player and award record
                        player_name = award_data.get('player_name', award_data.get('Player', ''))
                        if player_name:
                            player_id = self.get_or_create_player(player_name, tennis_sport_id)
                            
                            if not self.dry_run:
                                self.session.execute(
                                    text("""
                                        INSERT INTO player_awards (player_id, award_type_id, season, details)
                                        VALUES (:player_id, :award_type_id, :season, :details)
                                        ON CONFLICT (player_id, award_type_id, season) DO NOTHING
                                    """),
                                    {
                                        "player_id": player_id,
                                        "award_type_id": award_type_id,
                                        "season": award_data.get('season', award_data.get('Year', '2024')),
                                        "details": json.dumps(award_data)
                                    }
                                )
                            
                            self.stats['awards_migrated'] += 1
                    
                    except Exception as e:
                        error_msg = f"Error processing tennis award {award_data}: {e}"
                        logger.error(error_msg)
                        self.stats['errors'].append(error_msg)
            
            # Process tennis stats
            tennis_stats_file = processed_tennis_dir / "tennis_stats.json"
            if tennis_stats_file.exists():
                logger.info("Migrating tennis statistics...")
                with open(tennis_stats_file, 'r') as f:
                    tennis_stats = json.load(f)
                
                for stat_data in tennis_stats:
                    try:
                        player_name = stat_data.get('player_name', stat_data.get('Player', ''))
                        if player_name:
                            player_id = self.get_or_create_player(player_name, tennis_sport_id)
                            
                            # Process each statistic in the record
                            for stat_key, stat_value in stat_data.items():
                                if stat_key not in ['player_name', 'Player', 'season', 'Year']:
                                    try:
                                        if not self.dry_run:
                                            # Get or create statistic type
                                            result = self.session.execute(
                                                text("""
                                                    INSERT INTO statistic_types (name, display_name, category, sport_id)
                                                    VALUES (:name, :display_name, :category, :sport_id)
                                                    ON CONFLICT (name, sport_id) DO UPDATE SET
                                                        display_name = EXCLUDED.display_name
                                                    RETURNING id
                                                """),
                                                {
                                                    "name": stat_key.lower().replace(' ', '_'),
                                                    "display_name": stat_key.replace('_', ' ').title(),
                                                    "category": "performance",
                                                    "sport_id": tennis_sport_id
                                                }
                                            ).fetchone()
                                            stat_type_id = result[0]
                                        else:
                                            stat_type_id = 1  # Mock ID for dry run
                                        
                                        if not self.dry_run:
                                            self.session.execute(
                                                text("""
                                                    INSERT INTO player_statistics (player_id, statistic_type_id, season, value, context)
                                                    VALUES (:player_id, :statistic_type_id, :season, :value, :context)
                                                    ON CONFLICT (player_id, statistic_type_id, season) DO UPDATE SET
                                                        value = EXCLUDED.value, context = EXCLUDED.context
                                                """),
                                                {
                                                    "player_id": player_id,
                                                    "statistic_type_id": stat_type_id,
                                                    "season": stat_data.get('season', stat_data.get('Year', '2024')),
                                                    "value": str(stat_value),
                                                    "context": json.dumps({"original_data": stat_data})
                                                }
                                            )
                                        
                                        self.stats['statistics_migrated'] += 1
                                    
                                    except Exception as e:
                                        error_msg = f"Error processing tennis stat {stat_key}={stat_value} for {player_name}: {e}"
                                        logger.warning(error_msg)
                    
                    except Exception as e:
                        error_msg = f"Error processing tennis stat record {stat_data}: {e}"
                        logger.error(error_msg)
                        self.stats['errors'].append(error_msg)
            
            if not self.dry_run:
                self.session.commit()
                
        except Exception as e:
            if not self.dry_run:
                self.session.rollback()
            error_msg = f"Error migrating tennis data: {e}"
            logger.error(error_msg)
            self.stats['errors'].append(error_msg)

    def migrate_tennis_survival_data(self):
        """Migrate tennis survival data from survival_initials_map_tennis.json"""
        logger.info("Starting tennis survival data migration...")
        
        tennis_sport_id = self.get_or_create_sport('tennis')
        tennis_survival_file = Path("survival_initials_map_tennis.json")
        
        if not tennis_survival_file.exists():
            logger.warning("survival_initials_map_tennis.json not found, skipping tennis survival data migration")
            return
        
        try:
            with open(tennis_survival_file, 'r') as f:
                tennis_survival_data = json.load(f)
            
            initials_map = tennis_survival_data.get('initials_map', {})
            total_players = tennis_survival_data.get('total_players', 0)
            
            logger.info(f"Found {total_players} tennis players in survival data with {len(initials_map)} unique initial combinations")
            
            players_migrated = 0
            for initials, player_names in initials_map.items():
                for player_name in player_names:
                    try:
                        # Create player record
                        player_id = self.get_or_create_player(player_name, tennis_sport_id)
                        
                        # Create survival player record
                        if not self.dry_run:
                            self.session.execute(
                                text("""
                                    INSERT INTO survival_players (player_id, initials)
                                    VALUES (:player_id, :initials)
                                    ON CONFLICT (player_id) DO NOTHING
                                """),
                                {
                                    "player_id": player_id,
                                    "initials": initials
                                }
                            )
                        
                        players_migrated += 1
                        
                    except Exception as e:
                        error_msg = f"Error processing tennis survival player {player_name} ({initials}): {e}"
                        logger.error(error_msg)
                        self.stats['errors'].append(error_msg)
            
            self.stats['survival_players_migrated'] += players_migrated
            
            if not self.dry_run:
                self.session.commit()
            
            logger.info(f"Tennis survival data migration completed. Migrated: {players_migrated} players")
                
        except Exception as e:
            if not self.dry_run:
                self.session.rollback()
            error_msg = f"Error migrating tennis survival data: {e}"
            logger.error(error_msg)
            self.stats['errors'].append(error_msg)

    def run_migration(self):
        """Run the complete migration process"""
        logger.info("Starting FootQuizz JSON to PostgreSQL migration...")

        try:
            # Initialize connections and handlers
            self.connect_database()
            self.initialize_data_handlers()

            # Run migration phases
            logger.info("Phase 1: Migrating awards...")
            self.migrate_awards()

            logger.info("Phase 2: Migrating statistics...")
            self.migrate_statistics()

            logger.info("Phase 3: Migrating survival data...")
            self.migrate_survival_data()

            logger.info("Phase 4: Migrating tennis data...")
            self.migrate_tennis_data()

            logger.info("Phase 5: Migrating tennis survival data...")
            self.migrate_tennis_survival_data()

            # Print final statistics
            self.print_migration_summary()

            if self.stats['errors']:
                logger.warning(f"Migration completed with {len(self.stats['errors'])} errors")
                return False
            else:
                logger.info("Migration completed successfully!")
                return True

        except Exception as e:
            logger.error(f"Migration failed: {e}")
            return False

        finally:
            if self.session:
                self.session.close()
            if self.engine:
                self.engine.dispose()

    def print_migration_summary(self):
        """Print migration statistics summary"""
        logger.info("=" * 60)
        logger.info("MIGRATION SUMMARY")
        logger.info("=" * 60)
        logger.info(f"Players migrated: {self.stats['players_migrated']}")
        logger.info(f"Teams migrated: {self.stats['teams_migrated']}")
        logger.info(f"Awards migrated: {self.stats['awards_migrated']}")
        logger.info(f"Statistics migrated: {self.stats['statistics_migrated']}")
        logger.info(f"Tournaments migrated: {self.stats['tournaments_migrated']}")
        logger.info(f"Survival players migrated: {self.stats['survival_players_migrated']}")
        logger.info(f"Errors encountered: {len(self.stats['errors'])}")

        if self.stats['errors']:
            logger.info("\nERRORS:")
            for error in self.stats['errors'][:10]:  # Show first 10 errors
                logger.info(f"  - {error}")
            if len(self.stats['errors']) > 10:
                logger.info(f"  ... and {len(self.stats['errors']) - 10} more errors")

        logger.info("=" * 60)


def main():
    """Main entry point for the migration script"""
    parser = argparse.ArgumentParser(description='Migrate FootQuizz data from JSON to PostgreSQL')
    parser.add_argument('--database-url',
                       help='PostgreSQL connection string (e.g., postgresql://user:pass@host:port/dbname)')
    parser.add_argument('--config-file',
                       help='JSON configuration file with migration settings')
    parser.add_argument('--dry-run', action='store_true',
                       help='Perform validation without making database changes')
    parser.add_argument('--verbose', '-v', action='store_true',
                       help='Enable verbose logging')

    args = parser.parse_args()

    # Configure logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Get database URL
    database_url = args.database_url

    if args.config_file:
        try:
            with open(args.config_file, 'r') as f:
                config = json.load(f)
                database_url = config.get('database_url', database_url)
        except Exception as e:
            logger.error(f"Failed to load config file {args.config_file}: {e}")
            return 1

    if not database_url:
        database_url = os.environ.get('DATABASE_URL')

    if not database_url:
        logger.error("No database URL provided. Use --database-url, --config-file, or set DATABASE_URL environment variable")
        return 1

    # Run migration
    migrator = JSONToPostgreSQLMigrator(database_url, dry_run=args.dry_run)

    if args.dry_run:
        logger.info("DRY RUN MODE - No changes will be made to the database")

    success = migrator.run_migration()
    return 0 if success else 1


if __name__ == '__main__':
    sys.exit(main())