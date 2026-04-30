import PuzzlesClientPage from "./puzzles-client-page";
import { getDailyPuzzle } from "@/lib/puzzle-service";

export default async function PuzzlesPage() {
  let dailyPuzzle = null;

  try {
    dailyPuzzle = await getDailyPuzzle();
  } catch (error) {
    console.error("Failed to load daily puzzle for /puzzles:", error);
  }

  return <PuzzlesClientPage initialDailyPuzzle={dailyPuzzle} />;
}
