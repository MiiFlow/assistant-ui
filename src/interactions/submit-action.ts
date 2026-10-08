import type { VisualizationActionEvent } from "../types";

/** Legacy forms succeed only when their host explicitly acknowledges delivery. */
export async function submitVisualizationAction(
  handler: ((event: VisualizationActionEvent) => unknown) | undefined,
  event: VisualizationActionEvent,
) {
  if (!handler)
    throw new Error(
      "This form is not connected. Ask the assistant to continue in chat.",
    );
  const outcome = await handler(event);
  if (
    !outcome ||
    typeof outcome !== "object" ||
    !("accepted" in outcome) ||
    outcome.accepted !== true
  ) {
    throw new Error("Your response was not confirmed. Please try again.");
  }
}
