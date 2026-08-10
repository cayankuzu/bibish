#!/usr/bin/env sh
set -eu

: "${BIBISH_URL:?BIBISH_URL is required}"
: "${PLAYER_INDEX:?PLAYER_INDEX is required}"
: "${PLAYER_TEAM:?PLAYER_TEAM is required}"

SESSION="bibish-${PLAYER_INDEX}"
agent-browser --session "$SESSION" open "$BIBISH_URL"
agent-browser --session "$SESSION" set viewport 1440 900
agent-browser --session "$SESSION" wait 2000 >/dev/null
agent-browser --session "$SESSION" eval 'localStorage.setItem("bibish-graphics", JSON.stringify({mode:"ultra",dynamicResolution:false,showStats:true})); localStorage.setItem("bibish-audio-volume-v1", "0"); location.reload(); true'
READY=0
ATTEMPT=0
while [ "$ATTEMPT" -lt 20 ]; do
  VALUE="$(agent-browser --session "$SESSION" eval 'Boolean(globalThis.__bibishDebug?.joinLoadTest)' 2>/dev/null || true)"
  case "$VALUE" in
    *true*) READY=1; break ;;
  esac
  ATTEMPT=$((ATTEMPT + 1))
  agent-browser --session "$SESSION" wait 1000 >/dev/null
done
if [ "$READY" -ne 1 ]; then
  echo "BIBISH_BROWSER_NOT_READY"
  agent-browser --session "$SESSION" get title || true
  agent-browser --session "$SESSION" get url || true
  exit 2
fi
agent-browser --session "$SESSION" eval "globalThis.__bibishDebug.joinLoadTest('${PLAYER_TEAM}', ${PLAYER_INDEX}); globalThis.__bibishPilotMotion=setInterval(()=>globalThis.__bibishDebug.stepLoadTestGameplay(${PLAYER_INDEX}, performance.now()),50); true"
agent-browser --session "$SESSION" wait 30000
agent-browser --session "$SESSION" eval 'JSON.stringify({network:globalThis.__bibishDebug.getNetworkMetrics(),renderer:globalThis.__bibishDebug.getRendererMetrics(),load:globalThis.__bibishDebug.getLoadMetrics(),userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,deviceMemory:navigator.deviceMemory||null,longTasks:performance.getEntriesByType("longtask").map(entry=>entry.duration)})'
agent-browser --session "$SESSION" screenshot "/tmp/bibish-${PLAYER_INDEX}.png"
agent-browser --session "$SESSION" errors
agent-browser --session "$SESSION" console
agent-browser --session "$SESSION" close
