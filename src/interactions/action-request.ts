/** Common request envelope; each adapter owns its target, payload and revision. */
export interface InteractionActionRequest<
  Action extends string,
  Payload,
  Revision = number,
> {
  action: Action;
  payload: Payload;
  expectedRevision: Revision;
  idempotencyKey: string;
}

export interface InteractionActionOutcome {
  accepted: boolean;
  reason?: string;
  /** Transport loss / gateway failure: acceptance is unknown, not rejected. */
  uncertain?: boolean;
}
