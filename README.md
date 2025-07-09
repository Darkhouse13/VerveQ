# FootQuizz 🚀

Welcome to **FootQuizz**, a dynamic and engaging football quiz web application designed for fans of all levels. Test your knowledge with multiple game modes, track your progress on a comprehensive leaderboard, and unlock achievements as you prove your expertise.

![FootQuizz Screenshot](https://user-images.githubusercontent.com/12345/67890.png) <!--- Placeholder image -->

## ✨ Key Features

- **Dual-Server Architecture**: Runs on a high-performance **FastAPI** server with a seamless fallback to a **dependency-free Python minimal server**, ensuring maximum availability.
- **Multiple Game Modes**:
    - **Casual & Die-Hard Quizzes**: Difficulty-based quizzes with questions generated from a rich dataset of player awards and statistics.
    - **Survival Mode**: A fast-paced challenge to test the breadth of your football knowledge.
- **Enhanced Quiz Experience**: A modern, interactive UI with a real-time progress bar, streak counters, and an achievement system.
- **Comprehensive Leaderboard**: Track your high scores, speed records, accuracy, and longest streaks. Filter by game mode and time.
- **Advanced Analytics**: In-depth personal statistics and performance tracking.
- **Robust Backend**: Features include response caching, rate limiting, monitoring, and error tracking.
- **Offline Support**: A service worker provides a basic offline experience.
- **Accessibility Features**: Enhanced for better usability for all users.

## 🏛️ Architecture

FootQuizz is built with a unique dual-server architecture to ensure it's always available:

1.  **`web_server.py` (Primary)**: A powerful **FastAPI** server that provides the full-featured experience, including advanced game modes, analytics, and monitoring. It's the recommended way to run the application.
2.  **`minimal_server.py` (Fallback)**: A lightweight, dependency-free HTTP server built with Python's standard library. It serves the core quiz functionality and is perfect for environments where installing dependencies isn't possible.

The application's data is sourced from a collection of JSON files, validated against predefined schemas, and cached in memory to ensure high performance.

## 🎮 Game Modes

- **Enhanced Quiz (`enhanced_quiz.html`)**: The premium quiz experience. Choose between **Casual** (easier questions) and **Die-Hard** (challenging, obscure facts) difficulties. Features include a scoring system with streak bonuses, a timer, and instant feedback.
- **Survival Mode (`survival.html`)**: A two-player battle where you're given player initials and must name a valid player.
- **Leaderboard (`leaderboard.html`)**: View your rankings and detailed personal statistics.
- **Admin Dashboard (`admin_dashboard.html`)**: A monitoring dashboard to view system metrics and API performance.

## 🛠️ Installation & Setup

### Prerequisites

- Python 3.7+
- `pip` for installing dependencies

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/FootQuizz.git
    cd FootQuizz
    ```

2.  **Install the required Python packages:**
    ```bash
    pip install -r requirements.txt
    ```

## 🚀 Usage

You can start the application using either the main FastAPI server or the minimal fallback server.

### Running the FastAPI Server (Recommended)

To run the full-featured application, start the FastAPI server:

```bash
python web_server.py
```

The server will be available at `http://127.0.0.1:8008`.

- **Play the Enhanced Quiz**: `http://127.0.0.1:8008/enhanced_quiz.html`
- **API Docs**: `http://127.0.0.1:8008/docs`
- **Health Check**: `http://127.0.0.1:8008/health`

### Running the Minimal Server

If you cannot install the dependencies, you can run the core application with the minimal server:

```bash
python minimal_server.py
```

The server will be available at `http://127.0.0.1:8001`.

## 💻 Technology Stack

- **Backend**: Python, FastAPI, Uvicorn
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Data**: JSON
- **Key Python Libraries**: `fastapi`, `uvicorn`, `jsonschema`

## 📁 File Structure

```
.
├── data/                  # JSON data files for quizzes
├── schemas/               # JSON schemas for data validation
├── web_server.py          # Main FastAPI application server
├── minimal_server.py      # Fallback minimal HTTP server
├── Data.py                # Data loading, validation, and caching
├── QuizGenerator.py       # Logic for generating quiz questions
├── SurvivalDataHandler.py # Data handler for Survival Mode
├── enhanced_quiz.html     # Main quiz interface
├── leaderboard.html       # Leaderboard and stats page
├── enhanced_styles.css    # Styles for the enhanced UI
├── requirements.txt       # Python dependencies
└── README.md              # This file
```

## 🔮 Future Enhancements

Based on the successful delivery of Phase 2, potential future enhancements include:

- **Multiplayer Competitions**: Real-time competitive modes.
- **Custom Quiz Creation**: Allow users to generate their own quizzes.
- **Server-Side Leaderboards**: Move leaderboards to the backend for persistence.
- **Progressive Web App (PWA)**: Enhance the application with native-like features.

---

*This README was last updated on July 5, 2025.*
