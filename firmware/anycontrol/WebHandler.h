#pragma once

#include "Globals.h"
#include "OtaHandler.h"
#include "esp_ota_ops.h"

// -----------------------
// 1. Web 页面样式与组件
// -----------------------
static const char PAGE_CSS[] PROGMEM =
    "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;margin:0;padding:20px;background:#f0f2f5;color:#333} "
    ".container{max-width:860px;margin:0 auto} "
    ".header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px} "
    "h1{margin:0;font-size:22px;color:#1e293b;display:flex;align-items:center;gap:10px} "
    "h2{border-bottom:2px solid #3b82f6;padding-bottom:6px;font-size:16px;color:#1e40af;margin-top:0;margin-bottom:15px} "
    ".card{background:white;padding:20px;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,0.08);margin-bottom:20px} "
    ".grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px} "
    ".stat-box{background:#f8fafc;padding:12px;border-radius:8px;border:1px solid #e2e8f0;font-size:13px} "
    ".stat-val{font-size:18px;font-weight:bold;color:#0f172a;margin-top:4px} "
    ".form-item{display:flex;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:10px} "
    ".form-item label{display:inline-block;width:140px;margin-bottom:0;font-size:14px;color:#475569;font-weight:500;flex-shrink:0} "
    ".form-item input,.form-item select{padding:8px 12px;border:1px solid #cbd5e1;border-radius:6px;width:280px;box-sizing:border-box;font-size:14px;margin-bottom:0} "
    ".cur-tag{font-size:13px;color:#0369a1;background:#f0f9ff;padding:6px 12px;border-radius:6px;font-family:monospace;border:1px solid #bae6fd;white-space:nowrap} "
    "button{padding:8px 16px;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:500;transition:background 0.2s} "
    "button:hover{background:#1d4ed8} "
    ".save-btn{display:block;width:100%;padding:12px;font-size:16px;margin-top:15px;background:#16a34a} "
    ".save-btn:hover{background:#15803d} "
    ".badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:12px;background:#dbeafe;color:#1e40af;font-weight:600} "
    ".ota-box{margin-bottom:16px} "
    ".ota-label{display:block;font-size:14px;color:#475569;font-weight:500;margin-bottom:8px} "
    ".ota-input{width:100%;box-sizing:border-box;padding:10px 14px;border:1px solid #cbd5e1;border-radius:6px;font-size:14px;font-family:Consolas,Monaco,'Courier New',monospace;background:#fff;color:#0f172a;transition:border-color 0.2s} "
    ".ota-input:focus{border-color:#2563eb;outline:none;box-shadow:0 0 0 3px rgba(37,99,235,0.15)}";

static void handleHttpRoot() {
  String html;
  html.reserve(4096);
  g_httpServer.setContentLength(CONTENT_LENGTH_UNKNOWN);
  g_httpServer.send(200, "text/html; charset=utf-8", "");

  // HTML 头部与状态卡片
  html += "<!DOCTYPE html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>";
  html += "<title>AnyControl 工业智能网关</title><style>" + String(PAGE_CSS) + "</style></head><body><div class='container'>";
  html += "<div class='header'><h1 id='mainTitle'>⚡ AnyControl 智能网关 <span>v" FIRMWARE_VERSION "</span></h1></div>";

  // 系统监控概览
  html += "<div class='card'><h2>系统运行状态</h2>";
  html += "<div class='grid' id='sysStats'>";
  html += "<div class='stat-box'><div>CPU 频率</div><div class='stat-val'>-- MHz</div></div>";
  html += "<div class='stat-box'><div>内存占用</div><div class='stat-val'>-- %</div></div>";
  html += "<div class='stat-box'><div>Flash 占用</div><div class='stat-val'>-- %</div></div>";
  html += "<div class='stat-box'><div>芯片温度</div><div class='stat-val'>-- ℃</div></div>";
  html += "<div class='stat-box'><div>WiFi 信号</div><div class='stat-val'>-- dBm</div></div>";
  html += "<div class='stat-box'><div>运行时间</div><div class='stat-val'>--</div></div>";
  html += "</div></div>";
  g_httpServer.sendContent(html);
  html = "";
  html.reserve(4096);

  // 表单主体
  html += "<form method='POST' action='/config'>";

  // 1. 网络与 IP 参数配置卡片 (第一优先级)
  String activeIp = (WiFi.status() == WL_CONNECTED) ? WiFi.localIP().toString() : (WiFi.softAPIP().toString() + " (AP模式)");
  String activeMask = (WiFi.status() == WL_CONNECTED) ? WiFi.subnetMask().toString() : "255.255.255.0";
  String activeGw = (WiFi.status() == WL_CONNECTED) ? WiFi.gatewayIP().toString() : "--";
  String activeDns = (WiFi.status() == WL_CONNECTED) ? WiFi.dnsIP().toString() : "--";

  html += "<div class='card'><h2>WiFi 与静态 IP 网络配置</h2>";
  html += "<div class='form-item'><label>WiFi 名称 (SSID):</label><input name='wifiSsid' value='" + g_wifiStaConfig.ssid + "' placeholder='留空进入 AP 配网模式'></div>";
  html += "<div class='form-item'><label>WiFi 密码:</label><input name='wifiPwd' type='password' value='" + String(g_wifiStaConfig.password.length() > 0 ? "********" : "") + "' placeholder='WiFi 连接密码'></div>";
  
  html += "<div class='form-item'><label>IP 获取方式:</label><select name='wifiStatic'>";
  html += "<option value='0'" + String(!g_wifiStaConfig.useStaticIp ? " selected" : "") + ">DHCP (自动获取 IP)</option>";
  html += "<option value='1'" + String(g_wifiStaConfig.useStaticIp ? " selected" : "") + ">Static IP (固定静态 IP)</option>";
  html += "</select></div>";

  String curIp = g_wifiStaConfig.useStaticIp ? g_wifiStaConfig.ip.toString() : "";
  String curMask = g_wifiStaConfig.useStaticIp ? g_wifiStaConfig.subnet.toString() : "255.255.255.0";
  String curGw = g_wifiStaConfig.useStaticIp ? g_wifiStaConfig.gateway.toString() : "";
  String curDns = g_wifiStaConfig.useStaticIp ? g_wifiStaConfig.dns.toString() : "114.114.114.114";

  html += "<div class='form-item'><label>静态 IP 地址:</label><input name='wifiIp' value='" + curIp + "' placeholder='例如: 192.168.1.100'><span class='cur-tag' id='tagIp'>当前生效: " + activeIp + "</span></div>";
  html += "<div class='form-item'><label>子网掩码:</label><input name='wifiMask' value='" + curMask + "' placeholder='例如: 255.255.255.0'><span class='cur-tag' id='tagMask'>当前生效: " + activeMask + "</span></div>";
  html += "<div class='form-item'><label>默认网关:</label><input name='wifiGw' value='" + curGw + "' placeholder='例如: 192.168.1.1'><span class='cur-tag' id='tagGw'>当前生效: " + activeGw + "</span></div>";
  html += "<div class='form-item'><label>DNS 服务器:</label><input name='wifiDns' value='" + curDns + "' placeholder='例如: 114.114.114.114'><span class='cur-tag' id='tagDns'>当前生效: " + activeDns + "</span></div>";
  html += "</div>";

  // 2. RS485 通信与服务端口配置卡片
  html += "<div class='card'><h2>RS485 通信与服务端口配置</h2>";
  html += "<div class='form-item'><label>网关设备名称:</label><input name='gatewayName' value='" + g_gatewayName + "' placeholder='例如: 1号车间智能网关'></div>";
  html += "<p style='color:#0369a1;font-size:13px;background:#f0f9ff;padding:10px;border-radius:6px;border:1px solid #bae6fd;margin-top:10px'>";
  html += "<b>💡 通信通道说明：</b><br>• <b>RS485_A (UART0 / GPIO20, 21)</b>：原物理主站/触摸屏通道<br>• <b>RS485_B (UART1 / GPIO2, 10)</b>：现场物理从站总线<br>• <b>WiFi TCP Server</b>：AnyControl 上位机远程控制通道</p>";
  
  html += "<div class='form-item'><label>串口波特率:</label><select name='dmBaud'>";
  uint32_t bauds[] = {2400, 4800, 9600, 19200, 38400, 57600, 115200};
  for (int i = 0; i < 7; i++) {
    html += "<option value='" + String(bauds[i]) + "'" + (g_dualMasterConfig.masterBaud == bauds[i] ? " selected" : "") + ">" + String(bauds[i]) + "</option>";
  }
  html += "</select></div>";

  html += "<div class='form-item'><label>数据位:</label><select name='dmData'>";
  html += "<option value='8'" + String(g_dualMasterConfig.masterData == 8 ? " selected" : "") + ">8 位</option>";
  html += "<option value='7'" + String(g_dualMasterConfig.masterData == 7 ? " selected" : "") + ">7 位</option>";
  html += "</select></div>";

  html += "<div class='form-item'><label>校验位:</label><select name='dmParity'>";
  html += "<option value='0'" + String(g_dualMasterConfig.masterParity == 0 ? " selected" : "") + ">None (无校验)</option>";
  html += "<option value='1'" + String(g_dualMasterConfig.masterParity == 1 ? " selected" : "") + ">Even (偶校验)</option>";
  html += "<option value='2'" + String(g_dualMasterConfig.masterParity == 2 ? " selected" : "") + ">Odd (奇校验)</option>";
  html += "</select></div>";

  html += "<div class='form-item'><label>停止位:</label><select name='dmStop'>";
  html += "<option value='1'" + String(g_dualMasterConfig.masterStop == 1 ? " selected" : "") + ">1 位</option>";
  html += "<option value='2'" + String(g_dualMasterConfig.masterStop == 2 ? " selected" : "") + ">2 位</option>";
  html += "</select></div>";

  html += "<div class='form-item'><label>WiFi TCP 端口:</label><input name='dmWPort' type='number' value='" + String(g_dualMasterConfig.wifiPort) + "' placeholder='默认 9502'></div>";
  html += "<div class='form-item'><label>从站超时 (ms):</label><input name='dmTimeout' type='number' value='" + String(g_dualMasterConfig.masterTimeout) + "' placeholder='默认 1000'></div>";
  html += "<div class='form-item'><label>心跳周期 (秒):</label><input name='heartbeatInterval' type='number' value='" + String(g_heartbeatInterval) + "' placeholder='默认 30 秒'></div>";
  html += "</div>";
  g_httpServer.sendContent(html);
  html = "";
  html.reserve(4096);

  // 保存按钮
  html += "<button type='submit' class='save-btn'>💾 保存配置并重启设备</button></form>";

  // 3. OTA 固件更新与回滚卡片
  html += "<div class='card' style='margin-top:20px'><h2>系统固件在线更新 (OTA)</h2>";
  html += "<div class='ota-box'><label class='ota-label' for='otaApi'>OTA 服务端地址 (URL):</label>";
  html += "<input id='otaApi' class='ota-input' name='otaApi' value='" + g_otaApiBase + "' placeholder='https://your-firmware-worker.workers.dev'></div>";
  html += "<div id='otaInfo' style='margin:15px 0'><div style='padding:12px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;font-size:13px;color:#64748b'>点击下方按钮检查云端是否有新版本...</div></div>";
  html += "<div style='display:flex;gap:10px'>";
  html += "<button type='button' onclick='uiCheckOta()'>🔍 检查更新</button>";
  html += "<button type='button' id='btnDoUpdate' onclick='uiDoUpdate()' style='background:#dc2626;display:none'>⚡ 立即升级</button>";
  html += "</div>";

  // 回滚区
  String backupVer;
  bool canRollback;
  getBackupPartitionInfo(backupVer, canRollback);
  html += "<hr style='margin:20px 0;border:none;border-top:1px solid #e2e8f0'>";
  html += "<h3 style='font-size:14px;color:#334155;margin:0 0 10px 0'>固件双分区回滚 (A/B Partition)</h3>";
  if (canRollback) {
    html += "<p style='font-size:13px;color:#475569;margin-bottom:10px'>备用分区检测到历史版本：<b style='color:#0284c7'>v" + backupVer + "</b></p>";
    html += "<button type='button' onclick='uiRollback()' style='background:#ea580c'>⏪ 回滚到上一个版本 (v" + backupVer + ")</button>";
  } else {
    html += "<p style='font-size:13px;color:#94a3b8;margin:0'>备用分区暂无可回滚的历史固件镜像。</p>";
  }
  html += "</div>";

  // 4. 前端 JavaScript 交互逻辑
  html += "</div><script>";
  html += "async function refreshSysStats(){ try{ let r=await fetch('/api/sys/status'); let d=await r.json(); ";
  html += "const fmtUp=(s)=>{ if(s<60)return s+'s'; if(s<3600)return Math.floor(s/60)+'m '+(s%60)+'s'; return Math.floor(s/3600)+'h '+Math.floor((s%3600)/60)+'m'; }; ";
  html += "document.getElementById('sysStats').innerHTML=";
  html += "`<div class='stat-box'><div>CPU 频率</div><div class='stat-val'>${d.cpu} MHz</div></div>` + ";
  html += "`<div class='stat-box'><div>内存占用</div><div class='stat-val'>${d.ram} %</div></div>` + ";
  html += "`<div class='stat-box'><div>Flash 占用</div><div class='stat-val'>${d.flash} %</div></div>` + ";
  html += "`<div class='stat-box'><div>芯片温度</div><div class='stat-val'>${d.chipTemp !== undefined ? d.chipTemp + ' ℃' : '--'}</div></div>` + ";
  html += "`<div class='stat-box'><div>WiFi 信号</div><div class='stat-val'>${d.rssi} dBm</div></div>` + ";
  html += "`<div class='stat-box'><div>运行时间</div><div class='stat-val'>${fmtUp(d.uptime)}</div></div>`; ";
  html += "if(d.netIp && document.getElementById('tagIp')) document.getElementById('tagIp').innerText = '当前生效: ' + d.netIp; ";
  html += "if(d.netMask && document.getElementById('tagMask')) document.getElementById('tagMask').innerText = '当前生效: ' + d.netMask; ";
  html += "if(d.netGw && document.getElementById('tagGw')) document.getElementById('tagGw').innerText = '当前生效: ' + d.netGw; ";
  html += "if(d.netDns && document.getElementById('tagDns')) document.getElementById('tagDns').innerText = '当前生效: ' + d.netDns; ";
  html += "}catch(e){} }";
  html += "setInterval(refreshSysStats, 3000); refreshSysStats();";

  // 轻量 Markdown 渲染器（支持 ###/##/#、**bold**、`code`、- 列表、--- 分割线）
  html += "function mdToHtml(md){ ";
  html += "let lines=md.split('\\n'); let out=''; let inList=false; ";
  html += "for(let i=0;i<lines.length;i++){ let ln=lines[i]; ";
  // 水平分割线
  html += "if(/^-{3,}$/.test(ln.trim())){ if(inList){out+='</ul>';inList=false;} out+='<hr style=\"border:none;border-top:1px solid #d1fae5;margin:8px 0\">'; continue; } ";
  // 标题 ###
  html += "let hm=ln.match(/^(#{1,3})\\s+(.+)/); if(hm){ if(inList){out+='</ul>';inList=false;} let sz=hm[1].length; let fs=['15px','14px','13px'][sz-1]||'13px'; let fw=sz===1?'700':'600'; out+='<div style=\"font-size:'+fs+';font-weight:'+fw+';color:#15803d;margin:10px 0 4px\">'+hm[2]+'</div>'; continue; } ";
  // 列表项 -
  html += "let lm=ln.match(/^\\s*-\\s+(.*)/); if(lm){ if(!inList){out+='<ul style=\"margin:4px 0 4px 16px;padding:0\">'; inList=true;} ";
  html += "let li=lm[1].replace(/\\*\\*(.+?)\\*\\*/g,'<b>$1</b>').replace(/`([^`]+)`/g,'<code style=\"background:#f0fdf4;padding:1px 4px;border-radius:3px;font-size:11px\">$1</code>'); ";
  html += "out+='<li style=\"margin:2px 0;line-height:1.5;color:#374151\">'+li+'</li>'; continue; } ";
  // 普通行
  html += "if(inList){out+='</ul>';inList=false;} ";
  html += "let pl=ln.replace(/\\*\\*(.+?)\\*\\*/g,'<b>$1</b>').replace(/`([^`]+)`/g,'<code style=\"background:#f0fdf4;padding:1px 4px;border-radius:3px;font-size:11px\">$1</code>'); ";
  html += "if(pl.trim()!=='') out+='<div style=\"line-height:1.6;color:#374151;margin:2px 0\">'+pl+'</div>'; ";
  html += "} if(inList){out+='</ul>';} return out; }";

  html += "async function uiCheckOta(){ let s=document.getElementById('otaInfo'); ";
  html += "let urlInp=document.getElementById('otaApi'); let otaUrl=urlInp?urlInp.value.trim():''; ";
  html += "s.innerHTML=\"<div style='padding:12px;background:#e2e8f0;border-radius:6px;font-size:13px;color:#334155'>⏳ 正在连接云端校验更新，请稍候...</div>\"; ";
  html += "try{ let reqUrl='/api/ota/check' + (otaUrl ? ('?url=' + encodeURIComponent(otaUrl)) : ''); ";
  html += "let r=await fetch(reqUrl); let data=await r.json(); ";
  html += "let vStr = (data.version || '').startsWith('v') ? data.version : ('v' + (data.version || '')); ";
  html += "if(data.found){ ";
  html += "let logHtml = (data.changelog && data.changelog.trim().length > 0) ? mdToHtml(data.changelog.trim()) : \"<span style='color:#94a3b8;font-size:12px'>（暂无详细更新日志）</span>\"; ";
  html += "s.innerHTML=`<div style='background:#dcfce7;border-left:4px solid #16a34a;padding:12px 14px;border-radius:6px;color:#14532d;font-size:13px'><b style='font-size:15px;color:#15803d;display:block;margin-bottom:8px'>🎉 发现新版本: ${vStr}</b><div style='background:#fff;padding:10px 12px;border-radius:4px;border:1px solid #bbf7d0;font-size:12px;line-height:1.6;max-height:280px;overflow-y:auto'>${logHtml}</div></div>`; ";
  html += "document.getElementById('btnDoUpdate').style.display='inline-block'; ";
  html += "} else { ";
  html += "s.innerHTML=`<div style='padding:12px;background:#f0fdf4;border-radius:6px;border:1px solid #bbf7d0;color:#166534;font-size:13px'>✨ 当前已是最新版本 (${vStr})</div>`; ";
  html += "} }catch(e){ s.innerHTML=\"<div style='padding:12px;background:#fef2f2;border-radius:6px;border:1px solid #fecaca;color:#991b1b;font-size:13px'>❌ 检查失败，请检查网络连接或 OTA 服务端地址</div>\"; } }";

  html += "async function uiDoUpdate(){ if(!confirm('确认要执行系统固件在线升级吗？\\n升级过程中请勿断电，设备升级完成后将自动重启。'))return; ";
  html += "let btn=document.getElementById('btnDoUpdate'); btn.disabled=true; btn.innerText='正在校验并下载固件...'; ";
  html += "try{ let r=await fetch('/api/ota/do',{method:'POST'}); ";
  html += "if(!r.ok) throw new Error('固件下载校验失败'); ";
  html += "document.body.innerHTML='<div style=\"text-align:center;margin-top:100px\"><h2>正在执行固件写入与重启...</h2><p>请勿切断电源，预计需要 1-2 分钟。</p></div>'; ";
  html += "setTimeout(()=>location.href='/', 60000); ";
  html += "}catch(e){ alert('升级失败: '+e.message); btn.disabled=false; btn.innerText='立即升级'; } }";

  html += "async function uiRollback(){ if(!confirm('确认要回滚到上一个固件版本吗？\\n回滚完成后设备将自动重启。'))return; ";
  html += "try{ let r=await fetch('/api/ota/rollback',{method:'POST'}); let d=await r.json(); ";
  html += "if(d.ok){ document.body.innerHTML='<div style=\"text-align:center;margin-top:100px\"><h2>正在切换分区并重启...</h2><p>请稍候，系统将加载历史版本。</p></div>'; ";
  html += "setTimeout(()=>location.href='/', 10000); } else { alert('回滚失败: '+(d.error||'未知错误')); } ";
  html += "}catch(e){ alert('回滚请求失败: '+e.message); } }";

  html += "</script></body></html>";
  g_httpServer.sendContent(html);
  g_httpServer.sendContent("");
}

// -----------------------
// 2. HTTP 接口与参数持久化
// -----------------------

static void handleApiGatewayConfig() {
  String body = g_httpServer.arg("plain");
  String gwName = "";
  uint32_t baud = 0;
  uint8_t dataBits = 0;
  uint8_t parity = 0;
  uint8_t stopBits = 0;
  uint16_t wifiPort = 0;
  uint16_t masterTimeout = 0;
  uint32_t hbInt = 0;

  if (body.length() > 0) {
    DynamicJsonDocument doc(512);
    DeserializationError err = deserializeJson(doc, body);
    if (!err) {
      if (doc.containsKey("gatewayName")) gwName = doc["gatewayName"].as<String>();
      if (doc.containsKey("baud")) baud = doc["baud"].as<uint32_t>();
      if (doc.containsKey("dataBits")) dataBits = doc["dataBits"].as<uint8_t>();
      if (doc.containsKey("parity")) parity = doc["parity"].as<uint8_t>();
      if (doc.containsKey("stopBits")) stopBits = doc["stopBits"].as<uint8_t>();
      if (doc.containsKey("wifiPort")) wifiPort = doc["wifiPort"].as<uint16_t>();
      if (doc.containsKey("masterTimeout")) masterTimeout = doc["masterTimeout"].as<uint16_t>();
      if (doc.containsKey("timeout")) masterTimeout = doc["timeout"].as<uint16_t>();
      if (doc.containsKey("heartbeatInterval")) hbInt = doc["heartbeatInterval"].as<uint32_t>();
    }
  } else {
    gwName = g_httpServer.arg("gatewayName");
    if (g_httpServer.hasArg("baud")) baud = g_httpServer.arg("baud").toInt();
    if (g_httpServer.hasArg("dataBits")) dataBits = g_httpServer.arg("dataBits").toInt();
    if (g_httpServer.hasArg("parity")) parity = g_httpServer.arg("parity").toInt();
    if (g_httpServer.hasArg("stopBits")) stopBits = g_httpServer.arg("stopBits").toInt();
    if (g_httpServer.hasArg("wifiPort")) wifiPort = g_httpServer.arg("wifiPort").toInt();
    if (g_httpServer.hasArg("masterTimeout")) masterTimeout = g_httpServer.arg("masterTimeout").toInt();
    if (g_httpServer.hasArg("timeout")) masterTimeout = g_httpServer.arg("timeout").toInt();
    if (g_httpServer.hasArg("heartbeatInterval")) hbInt = g_httpServer.arg("heartbeatInterval").toInt();
  }

  if (!g_prefs.begin("anycontrol", false)) {
    g_httpServer.send(500, "application/json", "{\"success\":false,\"message\":\"NVS写入失败\"}");
    return;
  }

  if (gwName.length() > 0) {
    g_gatewayName = gwName;
    g_prefs.putString("gwName", gwName);
  }
  if (baud > 0) {
    g_dualMasterConfig.masterBaud = baud;
    g_prefs.putUInt("dmBaud", baud);
  }
  if (dataBits > 0) {
    g_dualMasterConfig.masterData = dataBits;
    g_prefs.putUChar("dmData", dataBits);
  }
  if (g_httpServer.hasArg("parity") || (body.length() > 0 && body.indexOf("parity") >= 0)) {
    g_dualMasterConfig.masterParity = parity;
    g_prefs.putUChar("dmParity", parity);
  }
  if (stopBits > 0) {
    g_dualMasterConfig.masterStop = stopBits;
    g_prefs.putUChar("dmStop", stopBits);
  }
  if (wifiPort > 0) {
    g_dualMasterConfig.wifiPort = wifiPort;
    g_prefs.putUShort("dmWPort", wifiPort);
  }
  if (masterTimeout > 0) {
    g_dualMasterConfig.masterTimeout = masterTimeout;
    g_prefs.putUShort("dmTimeout", masterTimeout);
  }
  // I4 修复：心跳周期保存条件与 handleHttpConfig 统一（hbInt > 0 且字段存在）
  bool hbIntPresent = (body.length() > 0)
    ? (body.indexOf("heartbeatInterval") >= 0)
    : g_httpServer.hasArg("heartbeatInterval");
  if (hbIntPresent && hbInt > 0) {
    g_heartbeatInterval = hbInt;
    g_prefs.putUInt("hbInt", hbInt);
  }

  g_prefs.end();

  // 热重载串口参数
  reconfigDualMasterSerial();

  DynamicJsonDocument resp(256);
  resp["success"] = true;
  resp["message"] = "通信串口参数、心跳周期与网关名称已成功更新并生效";
  JsonObject data = resp.createNestedObject("data");
  data["gatewayName"] = g_gatewayName;
  data["baud"] = g_dualMasterConfig.masterBaud;
  data["dataBits"] = g_dualMasterConfig.masterData;
  data["parity"] = g_dualMasterConfig.masterParity;
  data["stopBits"] = g_dualMasterConfig.masterStop;
  data["wifiPort"] = g_dualMasterConfig.wifiPort;
  data["masterTimeout"] = g_dualMasterConfig.masterTimeout;
  data["heartbeatInterval"] = g_heartbeatInterval;

  String out;
  serializeJson(resp, out);
  g_httpServer.send(200, "application/json", out);
}

static void handleHttpConfig() {
  String gwName = g_httpServer.arg("gatewayName");
  String wifiSsid = g_httpServer.arg("wifiSsid");
  String wifiPwd = g_httpServer.arg("wifiPwd");
  String dmBaud = g_httpServer.arg("dmBaud");
  String wifiStatic = g_httpServer.arg("wifiStatic");

  if (!g_prefs.begin("anycontrol", false)) {
    g_httpServer.send(500, "text/plain", "NVS Error");
    return;
  }

  // 网关名称
  if (gwName.length() > 0) {
    g_prefs.putString("gwName", gwName);
    g_gatewayName = gwName;
  }

  // 双主站中继参数
  if (dmBaud.length() > 0) {
    g_dualMasterConfig.masterBaud   = dmBaud.toInt();
    g_dualMasterConfig.masterData   = g_httpServer.arg("dmData").toInt();
    g_dualMasterConfig.masterParity = g_httpServer.arg("dmParity").toInt();
    g_dualMasterConfig.masterStop   = g_httpServer.arg("dmStop").toInt();
    g_dualMasterConfig.wifiPort     = g_httpServer.arg("dmWPort").toInt();
    if (g_httpServer.hasArg("dmTimeout")) {
      g_dualMasterConfig.masterTimeout = g_httpServer.arg("dmTimeout").toInt();
    }

    g_prefs.putUInt("dmBaud", g_dualMasterConfig.masterBaud);
    g_prefs.putUChar("dmData", g_dualMasterConfig.masterData);
    g_prefs.putUChar("dmParity", g_dualMasterConfig.masterParity);
    g_prefs.putUChar("dmStop", g_dualMasterConfig.masterStop);
    g_prefs.putUShort("dmWPort", g_dualMasterConfig.wifiPort);
    g_prefs.putUShort("dmTimeout", g_dualMasterConfig.masterTimeout);
  }

  // WiFi 配置保存
  if (wifiSsid.length() > 0 && wifiSsid.length() <= 32) {
    g_prefs.putString("wifiSsid", wifiSsid);
    if (wifiPwd.length() > 0 && wifiPwd != "********") {
      g_prefs.putString("wifiPwd", wifiPwd);
      g_wifiStaConfig.password = wifiPwd;
    }
    g_wifiStaConfig.ssid = wifiSsid;

    // 静态 IP 处理
    bool isStatic = (wifiStatic == "1");
    g_prefs.putBool("wifiStatic", isStatic);
    g_wifiStaConfig.useStaticIp = isStatic;

    if (isStatic) {
      IPAddress ip, mask, gw, dns;
      if (ip.fromString(g_httpServer.arg("wifiIp"))) {
        g_prefs.putUInt("wifiIp", (uint32_t)ip);
        g_wifiStaConfig.ip = ip;
      }
      if (mask.fromString(g_httpServer.arg("wifiMask"))) {
        g_prefs.putUInt("wifiMask", (uint32_t)mask);
        g_wifiStaConfig.subnet = mask;
      }
      if (gw.fromString(g_httpServer.arg("wifiGw"))) {
        g_prefs.putUInt("wifiGw", (uint32_t)gw);
        g_wifiStaConfig.gateway = gw;
      }
      if (dns.fromString(g_httpServer.arg("wifiDns"))) {
        g_prefs.putUInt("wifiDns", (uint32_t)dns);
        g_wifiStaConfig.dns = dns;
      }
    }

    g_wifiStaConfig.valid = true;
  }

  String hbIntStr = g_httpServer.arg("heartbeatInterval");
  if (hbIntStr.length() > 0 && hbIntStr.toInt() > 0) {
    g_heartbeatInterval = hbIntStr.toInt();
    g_prefs.putUInt("hbInt", g_heartbeatInterval);
  }

  g_prefs.end();
  g_needRestart = true;

  g_httpServer.send(200, "text/html; charset=utf-8",
      "<html><head><meta charset='utf-8'></head><body style='text-align:center;padding-top:80px;font-family:sans-serif'>"
      "<h2>✅ 配置已保存，设备正在重启...</h2><p>3 秒后将自动返回主页</p>"
      "<script>setTimeout(()=>location.href='/', 3000);</script></body></html>");
}

static void handleOtaCheck() {
  if (g_httpServer.hasArg("url")) {
    String url = g_httpServer.arg("url");
    url.trim();
    if (url.length() > 0) {
      g_otaApiBase = url;
      if (g_prefs.begin("anycontrol", false)) {
        g_prefs.putString("otaApi", g_otaApiBase);
        g_prefs.end();
      }
    }
  }
  int result = checkOtaUpdate();
  DynamicJsonDocument doc(4096);
  doc["found"] = (result == 1);
  doc["version"] = g_otaRemoteVersion != "" ? g_otaRemoteVersion : FIRMWARE_VERSION;
  doc["changelog"] = g_otaChangelog;
  String out;
  serializeJson(doc, out);
  g_httpServer.send(200, "application/json", out);
}

static void handleOtaUpdate() {
  if (validateFirmwareExistence()) {
    g_httpServer.send(200, "text/plain", "OK");
    delay(500);
    executeFirmwareUpdate();
  } else {
    g_httpServer.send(404, "text/plain", "Firmware not found");
  }
}

static void handleOtaStatus() {
  String json = "{\"found\":" + String(g_otaUpdateFound ? "true" : "false") +
                ",\"version\":\"" + g_otaRemoteVersion + "\"}";
  g_httpServer.sendHeader("Cache-Control", "no-cache");
  g_httpServer.send(200, "application/json", json);
}

static void handleOtaRollback() {
  if (executeRollback()) {
    g_httpServer.send(200, "application/json", "{\"ok\":true}");
    delay(1000);
    ESP.restart();
  } else {
    g_httpServer.send(200, "application/json", "{\"ok\":false,\"error\":\"备用分区无有效固件\"}");
  }
}

static void handleSystemStatus() {
  DynamicJsonDocument doc(512);
  doc["gatewayName"] = g_gatewayName;
  doc["firmware"] = FIRMWARE_VERSION;
  doc["cpu"] = ESP.getCpuFreqMHz();
  doc["ram"] = (int)((1.0f - (float)ESP.getFreeHeap() / ESP.getHeapSize()) * 100.0f);
  
  uint32_t usedFlash = ESP.getSketchSize();
  const esp_partition_t* running = esp_ota_get_running_partition();
  uint32_t totalFlash = (running != NULL) ? running->size : (usedFlash + ESP.getFreeSketchSpace());
  doc["flash"] = (int)((float)usedFlash / totalFlash * 100.0f);
  doc["rssi"] = (WiFi.status() == WL_CONNECTED) ? WiFi.RSSI() : 0;
  doc["uptime"] = millis() / 1000;
  doc["heartbeatInterval"] = g_heartbeatInterval;
  doc["busLatencyMs"] = g_lastBusLatencyMs;
  doc["master1Frames"] = g_master1FrameCount;
  doc["master2Frames"] = g_master2FrameCount;
  doc["busCrcErrors"] = g_busCrcErrorCount;
  #if defined(ARDUINO_ARCH_ESP32)
  doc["chipTemp"] = (int)(temperatureRead() * 10) / 10.0f;
  #endif

  if (WiFi.status() == WL_CONNECTED) {
    doc["netIp"] = WiFi.localIP().toString();
    doc["netMask"] = WiFi.subnetMask().toString();
    doc["netGw"] = WiFi.gatewayIP().toString();
    doc["netDns"] = WiFi.dnsIP().toString();
  } else {
    doc["netIp"] = WiFi.softAPIP().toString() + " (AP模式)";
    doc["netMask"] = "255.255.255.0";
    doc["netGw"] = WiFi.softAPIP().toString();
    doc["netDns"] = "--";
  }

  String out;
  serializeJson(doc, out);
  g_httpServer.send(200, "application/json", out);
}

static void initHttpServer() {
  g_httpServer.on("/", HTTP_GET, handleHttpRoot);
  g_httpServer.on("/config", HTTP_POST, handleHttpConfig);
  g_httpServer.on("/api/gateway/config", HTTP_POST, handleApiGatewayConfig);
  g_httpServer.on("/api/ota/check", HTTP_GET, handleOtaCheck);
  g_httpServer.on("/api/ota/do", HTTP_POST, handleOtaUpdate);
  g_httpServer.on("/api/ota/status", HTTP_GET, handleOtaStatus);
  g_httpServer.on("/api/ota/rollback", HTTP_POST, handleOtaRollback);
  g_httpServer.on("/api/sys/status", HTTP_GET, handleSystemStatus);
  g_httpServer.begin();
  APP_PRINTLN("[HTTP] Web Config Server started on port 80");
}
