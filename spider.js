
const fs = require('fs');
const path = require('path');
const http = require('http');

const JSON_FILE = path.join(__dirname, 'weather.json');

// ========== 你给的所有固定站点，写死在模板里 ==========
const districtSiteNames = [
  "徐家汇","宝山","崇明","嘉定","青浦","闵行","浦东","奉贤","松江","金山"
];

const detailSiteNames = [
  "嘉定安亭黄渡","青浦朱家角新旺","松江车墩高桥","奉贤庄行",
  "青浦朱家角珠溪","青浦白鹤朱浦","闵行马桥旗忠网球馆","宝山月浦网格中心",
  "闵行马桥女儿泾水闸","闵行虹桥","松江石湖荡张庄","闵行颛桥",
  "青浦金泽","松江方松泰晤士小镇","宝山罗店度假村","松江泖港腰泾",
  "嘉定南翔","浦东周家渡","金山山阳龙宇路","松江九亭高科技园区"
];
// =====================================================

// 抓取网页
function fetchHtml() {
  const opt = {
    hostname: "wx.soweather.com",
    path: "/wxapp/qxsk.jsp",
    timeout: 15000
  };
  const req = http.request(opt, res => {
    let html = "";
    res.setEncoding("utf8");
    res.on("data", d => html += d);
    res.on("end", () => {
      const data = parseFixedSite(html);
      saveJson(data);
    });
  });
  req.on("error", e => {
    console.error("抓取失败：", e.message);
    process.exit(1);
  });
  req.end();
}

// 按固定站点匹配温度
function parseFixedSite(html) {
  const now = new Date();
  const updateTimeISO = now.toISOString();
  const updateTimeLocal = now.toLocaleString("zh-CN");

  // 清理成纯文本
  let text = html.replace(/<[^>]+>/g," ").replace(/\s+/g," ");

  // 提取统计时段
  let timeMatch = text.match(/统计时段(\d{2}月\d{2}日\d{2}时\d{2}分)/);
  const statTime = timeMatch ? timeMatch[1] : "";

  // 匹配 站点名 温度1 温度2
  function getSiteList(nameArr) {
    let list = [];
    nameArr.forEach(name => {
      let reg = new RegExp(name + "\\s*([\\d\\.]+)\\s*([\\d\\.]+)","g");
      let m = reg.exec(text);
      if(m){
        list.push({
          siteName: name,
          minTemp: parseFloat(m[1]),
          maxTemp: parseFloat(m[2])
        });
      }
    });
    return list;
  }

  const districtSites = getSiteList(districtSiteNames);
  const detailSites = getSiteList(detailSiteNames);
  const allSites = [...districtSites, ...detailSites];

  // 全局最高最低
  let allMin = allSites.map(x=>x.minTemp);
  let allMax = allSites.map(x=>x.maxTemp);
  const globalMin = allMin.length ? Math.min(...allMin) : null;
  const globalMax = allMax.length ? Math.max(...allMax) : null;

  return {
    city: "上海市",
    sourceUrl: "http://wx.soweather.com/wxapp/qxsk.jsp",
    statTime: statTime,
    updateTimeISO: updateTimeISO,
    updateTimeLocal: updateTimeLocal,
    globalMinTemperature: globalMin,
    globalMaxTemperature: globalMax,
    districtSites: districtSites,
    detailSites: detailSites,
    allSites: allSites
  };
}

// 保存JSON
function saveJson(data) {
  fs.writeFile(JSON_FILE, JSON.stringify(data, null, 2), "utf8", err => {
    if(err){
      console.error("写入JSON失败",err);
      process.exit(1);
    }else{
      console.log("✅ 全部站点已匹配完成，写入 weather.json");
      console.log("区县站点数：",data.districtSites.length);
      console.log("细分站点数：",data.detailSites.length);
    }
  });
}

fetchHtml();
