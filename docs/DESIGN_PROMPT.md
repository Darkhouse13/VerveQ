# VerveQ UI Redesign — AI Design Generator Prompt

## Notes Before Using

- **Platform**: React Native + Expo (iOS, Android, Web from one codebase)
- **Generate mobile-first (phone) screens** — the web version reflows into wider layouts using the same design system. One set of mobile screens is sufficient; web layouts can be extrapolated from them.
- **Style**: Neo-brutalism

---

## THE PROMPT

Design a complete mobile app UI kit for **"VerveQ"** — a competitive sports trivia and guessing game platform. The style should be **neo-brutalism**: thick black borders (2-3px), solid offset drop shadows (no blur, black, 4-6px offset), chunky bold typography, high-contrast flat colors, raw geometric shapes, and a playful-but-competitive personality. Think Gumroad meets Duolingo meets a retro arcade cabinet.

### Brand Identity

- **App name**: VerveQ
- **Tagline**: "Prove Your Sports IQ"
- **Logo**: Bold "VQ" monogram in a chunky rounded rectangle with a thick black border and offset shadow
- **Primary color**: Electric Orange (#FF6B00)
- **Secondary colors**: Deep Black (#111111), Cream White (#FFF8F0), Acid Green (#B8FF00), Hot Pink (#FF3CAC), Electric Blue (#0085FF)
- **Accent neutrals**: Warm Gray (#E8E0D8), Charcoal (#2D2D2D)
- **Error**: Bright Red (#FF3B30), **Success**: Neon Green (#00D26A)
- **Dark mode**: Invert cream to near-black (#151515) backgrounds, keep the same vivid accent colors, borders become white or light gray instead of black

### Typography

- **Headings**: A chunky, geometric sans-serif (like Space Grotesk, Archivo Black, or DM Sans Bold). All-caps optional for impact.
- **Body**: Clean sans-serif (Inter, DM Sans Regular)
- **Numbers/Scores**: Monospace or tabular (JetBrains Mono, Space Mono) for leaderboards, timers, and scores
- **Sizes**: Large and confident. Headings should dominate. Don't be shy with 32-48px for key numbers.

### Neo-Brutalism Rules to Follow

1. **Every card, button, and container** gets a visible thick black border (2-3px) and a solid black offset shadow (4-6px down-right, no blur)
2. **Buttons** are chunky rectangles with bold text, thick borders, solid shadows. On press, the shadow collapses (button shifts down-right) for a satisfying "click" feel
3. **No soft gradients**. Use flat, bold colors. If you need depth, use solid shadow offsets
4. **Cards** are blocky, with sharp or slightly rounded corners (4-8px max). No glassmorphism, no frosted glass
5. **Borders are always visible**. No invisible dividers — use thick black lines
6. **Icons** should be bold line-weight (2-3px stroke), simple and geometric
7. **Color blocking**: Large sections of solid color. A quiz option card might be entirely acid green when selected, entirely hot pink when wrong
8. **Stickers/badges**: ELO tiers, achievement badges, and difficulty labels should look like physical stickers — rounded rectangles with thick borders, slightly rotated (-2 to 3 degrees) for personality
9. **Typography is loud**: Headings should feel like they're shouting. Bold, big, sometimes all-caps
10. **Whitespace is generous**: Let the bold elements breathe. Don't crowd the layout.

---

### Screens to Design (12 total)

#### 1. Login / Welcome Screen
- Large "VQ" logo with offset shadow
- App name "VerveQ" in chunky bold type below
- Tagline: "Prove Your Sports IQ"
- Text input for display name (thick bordered input field with offset shadow)
- Two main CTA buttons stacked: "Create Account" (orange, primary) and "Play as Guest" (cream/outline)
- "Quick Start" link text at bottom
- Personality: welcoming, bold, gets you in fast

#### 2. Onboarding (3 steps — show as a flow or single screen with step indicator)
- **Step indicator**: Chunky numbered circles (1, 2, 3) connected by thick dashed lines. Active step is orange-filled, completed steps have a checkmark
- **Step 1 — Welcome**: "Welcome to VerveQ!" heading. Three feature cards in a vertical stack:
  - "ELO Rankings" (with trophy icon)
  - "Quiz & Survival Modes" (with gamepad icon)
  - "Achievements" (with star icon)
  Each card is a neo-brutalist card (thick border, offset shadow, flat color background — one orange, one green, one blue)
- **Step 2 — Pick Your Sport**: Grid of sport cards (Football, Tennis, Basketball, More Coming). Each card has a large emoji/icon, sport name, thick border. Selected card gets orange background + larger shadow
- **Step 3 — Skill Level**: Three stacked cards (Beginner/Intermediate/Expert) with difficulty descriptions. Color-coded: green, amber, red. Each with thick borders and icons
- "Skip" text link + "Next" chunky button at bottom

#### 3. Home Screen (Main Hub — most complex screen)
- **Top bar**: User avatar (thick bordered circle) + greeting ("Hey, Player!") + notification bell icon
- **Metrics row**: Three metric chips in a horizontal row, each a mini neo-brutalist card:
  - Streak: "5 days" (orange background)
  - Best: "9/10" (green background)
  - Plays: "47" (blue background)
- **Today's Challenges section**: Heading "Today's Challenges" with two horizontal cards:
  - "Daily Quiz" card (orange accent, timer icon, "10 Questions")
  - "Survival Sprint" card (green accent, heart icon, "Beat your record")
- **Game Modes section**: Heading "Play" with two large cards stacked or side by side:
  - "Quiz Mode" card — large, with icon, "Test your knowledge", play button
  - "Survival Mode" card — large, with icon, "Guess players by initials", play button
  Both cards should be prominent, chunky, with different bold background colors
- **Recent Achievements**: Horizontal scrollable row of small achievement badges (sticker style, rotated, colorful)
- **Navigation**: Bottom tab bar with 4 tabs (Home, Leaderboard, Challenges, Profile) — thick top border, bold icons, active tab has orange indicator bar

#### 4. Sport Selection Screen
- Heading: "Pick a Sport" (large, bold)
- Subtitle: "Choose your arena"
- Grid of sport cards (2 columns):
  - Football (green card)
  - Tennis (yellow card)
  - Basketball (orange card)
  - More Sports (gray/dashed border card, "Coming Soon" label)
- Each card: Large emoji, sport name in bold, thick black border, offset shadow
- Selected state: Border becomes orange, shadow grows, subtle scale
- Back arrow button (top left, chunky)

#### 5. Difficulty Selection Screen
- Heading: "Choose Difficulty"
- Three large vertical cards:
  - **Easy**: Green background, "Casual fun, relaxed pace"
  - **Medium**: Amber/orange background, "Balanced challenge"
  - **Hard**: Red/hot pink background, "Expert level, no mercy"
- Each card has: emoji icon (large), difficulty name (bold, all-caps), description text, thick border, offset shadow
- Selected card: Larger shadow, slight scale up, border color change
- Subtitle at bottom: "You can always change this later"

#### 6. Quiz Screen (Core Gameplay — most important screen)
- **Header bar**:
  - Left: Score counter "Score: 750" (monospace, bold)
  - Center: Question counter "Q 4/10"
  - Right: Timer "0:08" countdown (monospace, large)
  - Difficulty badge (sticker style, rotated, e.g. "MEDIUM" in amber)
- **Question card**: Large white/cream card with thick border and offset shadow, question text in bold large type (e.g. "Who won the 2022 Ballon d'Or?")
- **Four answer options**: Stacked vertical cards, each with:
  - Option letter (A, B, C, D) in a chunky circle
  - Answer text
  - Thick border, offset shadow
  - **Default state**: Cream/white background
  - **Selected state**: Orange background, text turns white
  - **Correct answer reveal**: Acid green background, checkmark icon
  - **Wrong answer reveal**: Hot pink/red background, X icon
  - **Disabled state**: Grayed out after reveal
- **Submit button**: Full-width chunky orange button "CHECK ANSWER" (all-caps, bold)
- After reveal: Show explanation text below the options in a bordered info box
- "Tap to continue" hint at bottom

#### 7. Survival Screen (Guess-the-Player Game)
- **Header**: Lives display as chunky heart icons with thick borders, lost lives shown as gray/empty. Score counter on the right "Score: 12" in monospace
- **Challenge card**: Large centered card with:
  - "Who has these initials?" subtitle
  - **Initials display**: Huge bold letters (e.g. "C R") in individual letter blocks — each letter in its own square card with thick border and offset shadow, spaced apart
  - Round indicator badge (sticker style): "Round 5"
- **Input area**: Large text input with thick border, placeholder "Type player name..."
- **Action buttons row**:
  - "SUBMIT GUESS" — primary orange button (full width)
  - Below: Two half-width buttons: "USE HINT" (blue) and "SKIP" (gray)
- **Last result feedback**: Banner at top showing last guess result:
  - Correct: Green banner with checkmark and player name
  - Wrong: Red banner with X and "Try again"
- **Hint reveal**: When hint used, show a bordered card with sample player names

#### 8. Result Screen (Post-Game)
- **Large score display**: Huge number "8/10" or "Score: 15" in monospace bold (48-64px), centered, inside a card with thick border and large offset shadow
- **Performance grade**: Letter grade sticker (S, A, B, C, D) rotated 5 degrees, color-coded:
  - S: Gold/orange
  - A: Green
  - B: Blue
  - C: Amber
  - D: Red
- **Stars row**: 1-3 stars based on performance (filled = orange, empty = gray outline)
- **Stats breakdown**: Grid of stat cards:
  - "Correct": number
  - "Time": avg seconds
  - "Streak": best consecutive
  - "Accuracy": percentage
  Each in its own mini neo-brutalist card
- **ELO change**: "+15 ELO" or "-8 ELO" in bold, green for gain, red for loss, with arrow icon
- **Action buttons**:
  - "PLAY AGAIN" (orange, primary, large)
  - "TRY OTHER MODE" (outline/secondary)
  - "BACK TO HOME" (text link)
- Motivational text at bottom: "Great game! Keep climbing the ranks."

#### 9. Leaderboard Screen
- **Filter bar**: Row of filter chips (thick bordered pills):
  - Sport: "Football" / "Tennis" / "All"
  - Mode: "Quiz" / "Survival"
  - Period: "Daily" / "Weekly" / "All Time"
- **Podium section** (top 3):
  - Three blocky podium stands (1st tallest in center, 2nd left, 3rd right)
  - Each with user avatar (thick bordered circle), name, ELO rating
  - 1st place: Gold/orange, crown icon
  - 2nd place: Silver/gray
  - 3rd place: Bronze/amber
- **Rankings list** below podium: Scrollable list of player cards:
  - Each card: Rank number (bold) | Avatar | Username | ELO rating | Tier badge (sticker)
  - Thick bordered cards with offset shadow
  - Expandable on tap to show more stats (Games, Wins, Win %, Best Score)
  - "Challenge" button in expanded state

#### 10. Profile Screen
- **Header section**: Large user avatar (thick bordered, offset shadow), display name (bold, large), member since date
- **ELO card**: Current ELO rating in huge monospace type, tier badge (sticker), progress bar to next tier
- **Stats grid**: 2x2 grid of stat cards:
  - Total Games
  - Win Rate
  - Best Streak
  - Favorite Sport
  Each in a colored neo-brutalist card
- **Achievements section**: Heading + grid of achievement badges:
  - Unlocked: Full color, sticker style, slightly rotated
  - Locked: Grayed out, dashed border, lock icon
- **Recent Games**: Vertical list of game history cards (sport icon, mode, score, date, ELO change)
- **Action buttons**: "Edit Profile" (outline), "Share Profile" (orange)

#### 11. Challenge Screen
- **Create Challenge section**:
  - Heading "Challenge a Friend"
  - Username input (thick bordered)
  - Sport selector (horizontal pill buttons)
  - Mode selector (horizontal pill buttons)
  - "SEND CHALLENGE" button (orange, chunky)
- **Pending Challenges list**:
  - Cards showing: Challenger name, sport, mode, sent time
  - Two action buttons per card: "ACCEPT" (green) and "DECLINE" (red)
  - Empty state: Illustration + "No pending challenges" text
- **Quick Actions row**: Three icon buttons — "Leaderboards", "Profile", "Play Now"

#### 12. Dashboard Screen (Stats Overview)
- **Header stats**: Two large stat cards side by side:
  - "Total Games: 47" (orange background)
  - "Sports Played: 3" (blue background)
- **Best Scores section**: Per-sport breakdown cards:
  - Sport name + icon
  - Quiz best score
  - Survival best score
  - Color-coded by sport
- **Play buttons**: "Start Quiz" and "Start Survival" per sport
- Empty state for sports with no games: Dashed border card, "Play your first game!" text

---

### Additional Elements to Include

- **Toast notification**: Chunky notification bar at top with thick border, icon, message text, dismiss X
- **Loading skeleton**: Neo-brutalist skeleton — thick bordered empty rectangles with diagonal stripe animation
- **Empty states**: Illustration (simple geometric art) + bold heading + subtitle + CTA button
- **Modal/dialog**: Thick bordered overlay card with title, message, and chunky buttons
- **Achievement unlock animation concept**: Badge flies in, lands with "thunk" (offset shadow appears), slight rotation, confetti burst

### Design System Summary Card
Include one frame showing the design system at a glance:
- Color palette swatches (all colors with hex codes)
- Typography scale (heading, body, mono examples)
- Button states (default, hover, pressed, disabled)
- Card variants (default, selected, success, error)
- Icon style examples
- Spacing and border specifications
- Shadow specification (offset amount, color)

---

### Mood and Feel
The overall vibe should be: **competitive, bold, playful, energetic**. Like a sports bar meets an indie game UI. The thick borders and chunky shadows give it weight and tactile feel. The bright colors keep it fun and approachable. The monospace numbers feel scoreboard-like. The slightly rotated badge stickers add personality without being childish. It should feel like a premium indie app, not a corporate product.
