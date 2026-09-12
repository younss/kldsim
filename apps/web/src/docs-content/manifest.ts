import architecture from "./architecture.md?raw";
import playerJourney from "./player-journey.md?raw";
import facilitatorJourney from "./facilitator-journey.md?raw";
import adminJourney from "./admin-journey.md?raw";
import scoringFormulas from "./scoring-formulas.md?raw";
import scenarioAuthoring from "./scenario-authoring.md?raw";
import apiAndProviders from "./api-and-providers.md?raw";

export interface DocEntry {
  slug: string;
  title: string;
  section: string;
  content: string;
}

export const DOCS: DocEntry[] = [
  { slug: "architecture", title: "System Architecture", section: "Overview", content: architecture },
  { slug: "player-journey", title: "Player Journey", section: "User Journeys", content: playerJourney },
  { slug: "facilitator-journey", title: "Facilitator Journey", section: "User Journeys", content: facilitatorJourney },
  { slug: "admin-journey", title: "Platform Admin Journey", section: "User Journeys", content: adminJourney },
  { slug: "scoring-formulas", title: "Scoring & Simulation Mechanics", section: "Engine", content: scoringFormulas },
  { slug: "scenario-authoring", title: "Scenario Authoring Manual", section: "Game Studio", content: scenarioAuthoring },
  { slug: "api-and-providers", title: "API Reference & Provider Guide", section: "Reference", content: apiAndProviders },
];

export function getDoc(slug: string | undefined): DocEntry {
  return DOCS.find((d) => d.slug === slug) ?? DOCS[0]!;
}
