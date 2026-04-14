#!/usr/bin/env bash
# L3 模拟：用我们自己的 hook bundle 扮演 Claude Code 的调用者。
# 用 base64 包装 payload，避免脚本本身被自己的 hook 拦截（自引用干扰）。
set -e

HOOK=/c/bzli/teamagent/packages/cli/dist/bin-pre-tool-use.cjs
EVENTS=~/.teamagent/events.jsonl
INITIAL_LINES=$(wc -l < "$EVENTS" 2>/dev/null || echo 0)

# ---- 测试 1: Bash 下载类命令 ----
T1='eyJzZXNzaW9uX2lkIjoic2ltLXYxIiwiaG9va19ldmVudF9uYW1lIjoiUHJlVG9vbFVzZSIsImN3ZCI6Ii9jL2J6bGkvdGVhbWFnZW50IiwicGVybWlzc2lvbl9tb2RlIjoiZGVmYXVsdCIsInRyYW5zY3JpcHRfcGF0aCI6Ii90L3QiLCJ0b29sX25hbWUiOiJCYXNoIiwidG9vbF9pbnB1dCI6eyJjb21tYW5kIjoid2dldCAtLXZlcnNpb24ifSwidG9vbF91c2VfaWQiOiJ0MSJ9'
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "测试 1: Bash / download-like command"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
R1=$(echo "$T1" | base64 -d | node "$HOOK")
if echo "$R1" | grep -q "先检查下载目录"; then
  echo "✅ HIT: 命中 'check before download' 规则"
  echo "$R1" | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{const o=JSON.parse(d);process.stdout.write('  permissionDecision: '+(o.hookSpecificOutput&&o.hookSpecificOutput.permissionDecision)+'\n');process.stdout.write('  systemMessage 前 60 字: '+String(o.systemMessage||'').slice(0,60)+'...\n')})"
else
  echo "❌ MISS: 未命中"
  echo "$R1"
fi
echo ""

# ---- 测试 2: Write tool with console.log content ----
T2='eyJzZXNzaW9uX2lkIjoic2ltLXYyIiwiaG9va19ldmVudF9uYW1lIjoiUHJlVG9vbFVzZSIsImN3ZCI6Ii9jL2J6bGkvdGVhbWFnZW50IiwicGVybWlzc2lvbl9tb2RlIjoiZGVmYXVsdCIsInRyYW5zY3JpcHRfcGF0aCI6Ii90L3QiLCJ0b29sX25hbWUiOiJXcml0ZSIsInRvb2xfaW5wdXQiOnsiZmlsZV9wYXRoIjoiL3RtcC94LnRzIiwiY29udGVudCI6ImNvbnNvbGUubG9nKDEpIn0sInRvb2xfdXNlX2lkIjoidDIifQ=='
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "测试 2: Write / file with team-forbidden pattern"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
R2=$(echo "$T2" | base64 -d | node "$HOOK")
if echo "$R2" | grep -q "AttributionBus\|trace"; then
  echo "✅ HIT: 命中 'no console.log in hook code' team 规则"
  echo "$R2" | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{const o=JSON.parse(d);process.stdout.write('  permissionDecision: '+(o.hookSpecificOutput&&o.hookSpecificOutput.permissionDecision)+'\n')})"
else
  echo "❌ MISS: 未命中 (可能是 scope 过滤了)"
  echo "  result: $R2"
fi
echo ""

# ---- 测试 3: Edit tool adding fs import in core ----
T3='eyJzZXNzaW9uX2lkIjoic2ltLXYzIiwiaG9va19ldmVudF9uYW1lIjoiUHJlVG9vbFVzZSIsImN3ZCI6Ii9jL2J6bGkvdGVhbWFnZW50IiwicGVybWlzc2lvbl9tb2RlIjoiZGVmYXVsdCIsInRyYW5zY3JpcHRfcGF0aCI6Ii90L3QiLCJ0b29sX25hbWUiOiJFZGl0IiwidG9vbF9pbnB1dCI6eyJmaWxlX3BhdGgiOiJwYWNrYWdlcy9jb3JlL3NyYy9zY29yZXIudHMiLCJvbGRfc3RyaW5nIjoiWCIsIm5ld19zdHJpbmciOiJpbXBvcnQgZnMgZnJvbSBcIm5vZGU6ZnNcIiJ9LCJ0b29sX3VzZV9pZCI6InQzIn0='
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "测试 3: Edit / add forbidden pattern to core file"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
R3=$(echo "$T3" | base64 -d | node "$HOOK")
if echo "$R3" | grep -q "adapter\|纯函数\|IO"; then
  echo "✅ HIT: 命中 'no fs in core' team 规则"
else
  echo "❌ MISS"
  echo "  result: $R3"
fi
echo ""

# ---- 事件留痕核对 ----
FINAL_LINES=$(wc -l < "$EVENTS")
NEW=$((FINAL_LINES - INITIAL_LINES))
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "事件留痕: 本次测试新增 $NEW 条 (events.jsonl 从 $INITIAL_LINES → $FINAL_LINES 行)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "最后 6 条事件（应该包含本次的 3 个 intervention）:"
tail -6 "$EVENTS" | node -e "
  const lines = require('fs').readFileSync(0,'utf-8').split(/\r?\n/).filter(Boolean);
  for (const l of lines) {
    const e = JSON.parse(l);
    const t = e.tool ? e.tool.name : '-';
    console.log('  ' + e.timestamp + '  ' + e.kind.padEnd(20) + '  ' + t + '  session=' + (e.session_id||'-'));
  }
"
