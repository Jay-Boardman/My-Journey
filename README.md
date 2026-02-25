# Mounjaro Journey Tracker

A personal weight loss and wellness companion designed specifically for users on Mounjaro (Tirzepatide).

## Features

- **Injection Tracking:** Log your weekly shots, dose, and injection site. Includes a countdown to your next dose.
- **AI Meal Estimator:** Type what you ate and get instant AI-powered estimates for calories and protein.
- **Weight & BMI Progress:** Track your weight in Lbs, Kg, or Stone. Automatic BMI calculation and progress visualization.
- **Wellness Logging:** Track your mood, side effects, and daily hydration.
- **AI Health Coach:** Get personalized tips and motivation based on your recent logs.

## Tech Stack

- **Frontend:** React + TypeScript + Tailwind CSS
- **Icons:** Lucide React
- **Charts:** Recharts
- **AI:** Google Gemini API (via `@google/genai`)
- **Animations:** Motion (Framer Motion)
- **Date Handling:** date-fns

## Getting Started

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd mounjaro-journey
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up Environment Variables:**
   Create a `.env` file in the root directory and add your Gemini API key:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Build for production:**
   ```bash
   npm run build
   ```

## Deployment

This app is a static Single Page Application (SPA). You can easily deploy it to:
- **Vercel** (Recommended)
- **Netlify**
- **GitHub Pages**

## License

MIT
