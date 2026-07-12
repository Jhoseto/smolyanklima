"use client";

import { useState } from "react";
import { WorkItemsPlanner } from "./WorkItemsPlanner";

type DashboardPlannerMountProps = {
  readOnly?: boolean;
  canDeleteEvents?: boolean;
};

/**
 * Нов mount key при всяко отваряне на страницата с таблото —
 * Next.js router cache не запазва избран ден от предишно посещение.
 */
export function DashboardPlannerMount(props: DashboardPlannerMountProps) {
  const [mountKey] = useState(() => Date.now());
  return <WorkItemsPlanner key={mountKey} {...props} />;
}
