// Only the selected bay is read. Coalesce ticks while a request is in flight;
// selection/session changes abort it and invalidate even an uncancellable reply.
export function createBayDetailLoader({ fetchDetail, onChange }) {
  let target = null, job = null, attempted = undefined, generation = 0;
  let state = { detail: null, loading: false, error: false };
  const publish = patch => { state = { ...state, ...patch }; onChange(state); };
  const seq = detail => detail?.frame?.seq ?? null;
  const caughtUp = () => state.detail && (target.seq === null ? seq(state.detail) === null : seq(state.detail) >= target.seq);
  function pump(force = false) {
    if (!target || job || (!force && (caughtUp() || attempted === target.seq))) return;
    const wanted = { ...target }, version = generation, controller = new AbortController();
    const current = { controller }; job = current; attempted = wanted.seq;
    publish({ loading: true, error: false });
    Promise.resolve().then(() => fetchDetail(wanted.bayId, controller.signal)).then(detail => {
      if (version !== generation) return;
      if (detail?.session?.id !== wanted.sessionId || detail?.bay?.id !== wanted.bayId || detail.sourceType !== 'simulation' || detail.exportable !== false ||
          (detail.frame && (detail.frame.bayId !== wanted.bayId || detail.frame.sourceType !== 'simulation' || !Number.isSafeInteger(detail.frame.seq))) ||
          (wanted.seq !== null && (seq(detail) === null || seq(detail) < wanted.seq))) throw Error('BAY_DETAIL_MISMATCH');
      publish({ detail, error: false });
    }).catch(() => { if (version === generation) publish({ error: true }); }).finally(() => {
      if (job !== current) return;
      job = null; publish({ loading: false }); pump();
    });
  }
  function update(next) {
    if (!next || next.bayId !== target?.bayId || next.sessionId !== target?.sessionId) {
      generation++; job?.controller.abort(); job = null; attempted = undefined;
      target = next; publish({ detail: null, loading: false, error: false });
    } else target = next;
    pump();
  }
  return { update, retry: () => pump(true), get state() { return state; }, close: () => update(null) };
}
