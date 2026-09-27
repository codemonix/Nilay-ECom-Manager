/**
 * Decision rules of Packing's two warning dialogs (docs/order-status-mchine.md,
 * "Dialog A" and "Dialog B"), kept free of React so they can be unit-tested.
 * A group's "final picture" counts as taken once it has at least one photo.
 */

export type SaveDecision = "send" | "warn_no_picture";

/** Dialog A -- Save: without any picture, warn first (Cancel / Take picture / Confirm); otherwise save straight away. */
export function decideSave(group: { photoCount: number }): SaveDecision {
  return group.photoCount > 0 ? "send" : "warn_no_picture";
}

export type MoveDecision = "move" | "warn_no_picture";

/**
 * Dialog B -- moving to another customer group (never changes a status):
 * warn only when every item of the group being left is green but no picture
 * was taken. Moving between orders of the same group never warns.
 */
export function decideMove(params: { leavingGroup: boolean; allItemsMarkedGreen: boolean; photoCount: number }): MoveDecision {
  if (!params.leavingGroup) return "move";
  return params.allItemsMarkedGreen && params.photoCount === 0 ? "warn_no_picture" : "move";
}

/** Dialog results; "take_picture" opens the camera and stays put -- the user must press Save / Next again themselves. */
export type WarningChoice = "cancel" | "take_picture" | "confirm";
