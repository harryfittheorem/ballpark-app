import type { ComponentType } from "react";
import Slide01Title from "./pages/slides/Slide01Title";
import Slide02Problem from "./pages/slides/Slide02Problem";
import Slide03MarcusRivera from "./pages/slides/Slide03MarcusRivera";
import Slide04HitTrax from "./pages/slides/Slide04HitTrax";
import Slide05VideoMessaging from "./pages/slides/Slide05VideoMessaging";
import Slide06DrillAssignments from "./pages/slides/Slide06DrillAssignments";
import Slide07Gamification from "./pages/slides/Slide07Gamification";
import Slide08Differentiators from "./pages/slides/Slide08Differentiators";
import Slide09TechStack from "./pages/slides/Slide09TechStack";
import Slide10MultiTenant from "./pages/slides/Slide10MultiTenant";
import Slide11PilotPlan from "./pages/slides/Slide11PilotPlan";
import Slide12PilotMetrics from "./pages/slides/Slide12PilotMetrics";
import Slide13Roadmap from "./pages/slides/Slide13Roadmap";
import Slide14TheAsk from "./pages/slides/Slide14TheAsk";
import Slide15Closing from "./pages/slides/Slide15Closing";
import manifest from "./data/slides-manifest.json";

export const slides = manifest;

export const components: Record<string, ComponentType> = {
  [manifest[0].id]: Slide01Title,
  [manifest[1].id]: Slide02Problem,
  [manifest[2].id]: Slide03MarcusRivera,
  [manifest[3].id]: Slide04HitTrax,
  [manifest[4].id]: Slide05VideoMessaging,
  [manifest[5].id]: Slide06DrillAssignments,
  [manifest[6].id]: Slide07Gamification,
  [manifest[7].id]: Slide08Differentiators,
  [manifest[8].id]: Slide09TechStack,
  [manifest[9].id]: Slide10MultiTenant,
  [manifest[10].id]: Slide11PilotPlan,
  [manifest[11].id]: Slide12PilotMetrics,
  [manifest[12].id]: Slide13Roadmap,
  [manifest[13].id]: Slide14TheAsk,
  [manifest[14].id]: Slide15Closing,
};
