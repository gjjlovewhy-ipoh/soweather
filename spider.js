const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// 目标天气页面
const targetUrl = "wx.soweather.com";
const targetPath = "/wxapp/qxsk.jsp";

// 结果JSON文件路径
const jsonPath = path.join(__dirname, 'weather.json');

function fetchPage() {
  const options = {
    hostname: targetUrl,
    path: targetPath,
    method: 'GET',
    timeout: 10000
  };

  const req = http.request(options, (res) => {
    let html = '';
    res.on('data', chunk => html += chunk.toString('utf8'));
    res.on('end', () => {
      const result = parseWeather(html);
      saveJson(result);
    });
  });

  req.on('error', (err) => {
    console.error('抓取页面失败：', err.message);
    process.exit(1);
  });

  req.end();
}

// 解析页面提取区域、温度、时间
function parseWeather(html) {
  const now = new Date();
  const updateTime = now.toISOString();
  const localTime = now.toLocaleString('zh-CN');

  // 简单清洗HTML标签
  let text = html.replace(/<[^>]+>/g, ' ')
                 .replace(/\s+/g, ' ')
                 .trim();

  // 正则匹配温度、区域（适配上海气象实况格式）
  const areaTempReg = /([\u4e00-\u9fa5]+?)[:：\s]*([\d\.]+)℃/g;
  let areaList = [];
  let match;

  while ((match = areaTempReg.exec(text)) !== null) {
    areaList.push({
      area: match[1].trim(),
      temperature: parseFloat(match[2])
    });
  }

  // 计算最高温、最低温
  let maxTemp = null, minTemp = null;
  if (areaList.length > 0) {
    const temps = areaList.map(item => item.temperature);
    maxTemp = Math.max(...temps);
    minTemp = Math.min(...temps);
  }

  return {
    updateTimeISO: updateTime,
    updateTimeLocal: localTime,
    sourceUrl: "http://wx.soweather.com/wxapp/qxsk.jsp",
    city: "上海",
    maxTemperature: maxTemp,
    minTemperature: minTemp,
    areaWeatherList: areaList,
    rawText: text.substring(0, 600)
  };
}

// 写入JSON到根目录
function saveJson(data) {
  fs.writeFile(jsonPath, JSON.stringify(data, null, 2), 'utf8', (err) => {
    if (err) {
      console.error('写入JSON失败：', err);
      process.exit(1);
    } else {
      console.log('✅ 天气数据已保存到 weather.json');
      console.log(data);
    }
  });
}

// 启动爬虫
fetchPage();
