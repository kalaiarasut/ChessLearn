import PuzzlesClientPage from "./puzzles-client-page";
import { getDailyPuzzle } from "@/lib/puzzle-service";

export default async function PuzzlesPage() {
  const dailyPuzzle = await getDailyPuzzle();
  return <PuzzlesClientPage initialDailyPuzzle={dailyPuzzle} />;
}
