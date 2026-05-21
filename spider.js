const fs = require('fs');
const path = require('path');
const http = require('http');

const HOST = 'wx.soweather.com';
const PATH = '/wxapp/qxsk.jsp';
const JSON_PATH = path.join(__dirname, 'weather.json');

// 发起请求抓取页面
function getPageHtml() {
    const options = {
        hostname: HOST,
        path: PATH,
        method: 'GET',
        timeout: 15000
    };

    const req = http.request(options, res => {
        let html = '';
        res.setEncoding('utf8');
        res.on('data', chunk => html += chunk);
        res.on('end', () => {
            const weatherData = parseAllWeather(html);
            saveJson(weatherData);
        });
    });

    req.on('error', err => {
        console.error('抓取页面失败：', err.message);
        process.exit(1);
    });

    req.end();
}

// 完整解析所有站点数据
function parseAllWeather(html) {
    const now = new Date();
    const updateTimeISO = now.toISOString();
    const updateTimeLocal = now.toLocaleString('zh-CN');

    // 清理html标签、换行空格
    let text = html
        .replace(/<[^>]+>/g, '\n')
        .replace(/\r\n|\r/g, '\n')
        .replace(/\n+/g, '\n')
        .replace(/^\s+|\s+$/g, '');

    // 1. 提取统计时段 例如：05月21日14时50分
    let timeMatch = text.match(/统计时段(\d{2}月\d{2}日\d{2}时\d{2}分)/);
    const statTime = timeMatch ? timeMatch[1] : '';

    // 2. 分割两大块：区县主站点、其他所有细分站点
    const districtPart = text.match(/站点\s*最小值（℃）\s*最大值（℃）\s*([\s\S]*?)其它站点排行（从高到低）/);
    const otherPart = text.match(/其它站点排行（从高到低）\s*([\s\S]*?)$/);

    const districtText = districtPart ? districtPart[1] : '';
    const otherText = otherPart ? otherPart[1] : '';

    // 3. 解析所有行：站点 最低温 最高温
    const districtList = parseLineToSite(districtText);
    const otherSiteList = parseLineToSite(otherText);

    // 4. 合并所有站点，用于全局最高最低温统计
    const allSiteList = [...districtList, ...otherSiteList];
    const allMinTemp = allSiteList.map(item => item.minTemp);
    const allMaxTemp = allSiteList.map(item => item.maxTemp);

    const globalMin = allMinTemp.length ? Math.min(...allMinTemp) : null;
    const globalMax = allMaxTemp.length ? Math.max(...allMaxTemp) : null;

    return {
        city: "上海市",
        sourceUrl: "http://wx.soweather.com/wxapp/qxsk.jsp",
        statTime: statTime,
        updateTimeISO: updateTimeISO,
        updateTimeLocal: updateTimeLocal,
        globalMinTemperature: globalMin,
        globalMaxTemperature: globalMax,
        districtSites: districtList,
        detailSites: otherSiteList,
        allSites: allSiteList
    };
}

// 逐行解析：匹配 站点名 最低温 最高温
function parseLineToSite(textStr) {
    const list = [];
    // 拆分行、去空行、去首尾空格
    const lines = textStr.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    // 正则：匹配中文站点 + 空格 + 数字 + 空格 + 数字
    const reg = /^([\u4e00-\u9fa5a-zA-Z0-9]+)\s+([\d\.]+)\s+([\d\.]+)$/;

    lines.forEach(line => {
        const res = line.match(reg);
        if (res) {
            list.push({
                siteName: res[1].trim(),
                minTemp: parseFloat(res[2]),
                maxTemp: parseFloat(res[3])
            });
        }
    });
    return list;
}

// 保存为JSON
function saveJson(data) {
    fs.writeFile(JSON_PATH, JSON.stringify(data, null, 2), 'utf8', err => {
        if (err) {
            console.error('写入weather.json失败：', err);
            process.exit(1);
        } else {
            console.log('✅ 所有站点解析完成，已保存到 weather.json');
            console.log('共解析站点数量：', data.allSites.length);
        }
    });
}

// 启动爬虫
getPageHtml();
