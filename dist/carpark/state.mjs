// Presentation only. Server summaries remain the source of rule/alert status.
export function displayBay(bay, connected = true) {
  const knownAlert = ['warning', 'danger'].includes(bay?.status);
  const noData = !connected || !bay || Boolean(bay.noData) || !['normal', 'warning', 'danger'].includes(bay.status);
  return {
    ...bay,
    status: knownAlert ? bay.status : noData ? 'no_data' : 'normal',
    noData,
    connecting: connected && Boolean(bay?.connecting),
    peakC: typeof bay?.peakC === 'number' && Number.isFinite(bay.peakC) ? bay.peakC : null
  };
}

export function countBayStates(bays, connected = true) {
  const counts = { normal: 0, warning: 0, danger: 0, no_data: 0 };
  for (const bay of bays) counts[displayBay(bay, connected).status]++;
  return counts;
}

export function displayAlerts(alerts, bays, connected = true) {
  return alerts.map(alert => {
    const bay = bays.find(item => item.id === alert.bayId);
    return { ...alert, noData: displayBay(bay, connected).noData };
  });
}

export function bayInDirection(bays, currentId, key) {
  const current = bays.find(bay => bay.id === currentId);
  const offset = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[key];
  if (!current || !offset) return currentId;
  return bays.find(bay => bay.row === current.row + offset[0] && bay.col === current.col + offset[1])?.id ?? currentId;
}
