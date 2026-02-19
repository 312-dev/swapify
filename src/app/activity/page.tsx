import { requireAuth } from "@/lib/auth";
import ActivityClient from "./ActivityClient";

export default async function ActivityPage() {
  await requireAuth();
  return <ActivityClient />;
}
