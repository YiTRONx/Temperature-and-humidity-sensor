// pages/detaileddaily/detaileddaily.js
const app = getApp();

Page({
  data: {
    fullUUID: "",
    deviceId: "",
    equNAME: "",
    equID: "",
    thisDevices: null,
    selectDate: "",
    todayDate: "",
    dailyChart: null,
    // 新增：区分原始数据和简化后数据
    rawChartData: [], // 原始完整数据
    chartData: [],    // 简化后用于绘图的数据
    tempData: [],
    humData: [],
    dateList: [],      // 新增：服务器返回的可用日期列表
    dateIndex: 0       // 新增：选择器索引
  },

  onLoad(options) {
    const { fullUUID, deviceId, equNAME } = options;
    const decodeName = decodeURIComponent(equNAME || '温湿度传感器');
    const header = (fullUUID || '').substring(0, 8);
    const footer = (fullUUID || '').substring(24);
    
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,0)}-${String(now.getDate()).padStart(2,0)}`;



    this.setData({
      fullUUID: fullUUID || '74685301-2022-2026-0114-6D2B8A3F9E1C',
      deviceId: deviceId || '1',
      equNAME: decodeName,
      equID: `${header}-${footer}`,
      selectDate: today,
      todayDate: today
    });
    this.getAvailableDates();
    this.getDeviceInfo();
    this.initChart();
    this.loadLocalData();
  },


  // 新增：从服务器获取该设备有数据的日期列表
getAvailableDates() {
    const { fullUUID } = this.data;
    if (!fullUUID) return;
  
    wx.request({
      url: `https://3bbf0a5c.r31.cpolar.top/getAvailableDates?UUID=${fullUUID}`,
      method: 'GET',
      success: (res) => {
        const dateList = res.data || [];
        if (dateList.length > 0) {
          // 默认选中第一个日期
          this.setData({
            dateList,
            dateIndex: 0,
            selectDate: dateList[0]
          }, () => {
            this.loadLocalData(); // 加载默认日期数据
          });
        } else {
          wx.showToast({ title: '暂无历史数据', icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '获取日期失败', icon: 'none' });
      }
    });
  },
// 新增：动态选择有数据的日期
onDateChange(e) {
    const index = e.detail.value;
    const selectDate = this.data.dateList[index];
    this.setData({
      dateIndex: index,
      selectDate
    }, () => {
      this.loadLocalData(); // 重新加载数据
      wx.showToast({ title: selectDate, icon: 'none' });
    });
  },

//   onDateChange(e) {
//     const newDate = e.detail.value;
//     this.setData({ selectDate: newDate }, () => {
//       this.loadLocalData();
//       wx.showToast({ title: `已选择：${newDate}`, icon: 'none' });
//     });
//   },

  getDeviceInfo() {
    const list = app.globalData.SaveSelectedList || [];
    const device = list.find(item => item.deviceId === this.data.deviceId);
    this.setData({ thisDevices: device || { IsOnline: true } });
  },

  // 加载原始数据
//   loadLocalData() {
//     wx.showLoading({ title: '加载并简化数据中...' });
//     // 示例：更多原始数据（模拟大量数据场景）
//     const csvData = `2026-03-15 10:56:41,20,59.7
//     2026-03-15 10:56:45,20.1,58.3
//     2026-03-15 10:56:47,20.1,57.8
//     2026-03-15 10:56:49,20.2,57.5
//     2026-03-15 10:56:51,20.2,57.1
//     2026-03-15 10:56:53,20.2,56.8
//     2026-03-15 10:56:55,20.3,56.6
//     `;

//     this.parseCSV(csvData);
//     wx.hideLoading();
//   },
// 加载原始数据
loadLocalData() {
    wx.showLoading({ title: '加载中...' });
    // 1. 获取请求参数（选择的日期 + 页面传递的fullUUID）
    const { selectDate, fullUUID } = this.data;
    // 2. 拼接服务器请求URL（请替换为实际的服务器域名/IP）
    const requestUrl = `https://3bbf0a5c.r31.cpolar.top/history?date=${selectDate}&&UUID=${fullUUID}`;
  
    // 3. 发起GET请求获取服务器上的CSV数据
    wx.request({
      url: requestUrl,
      method: 'GET',
      timeout: 10000, // 超时时间10秒，可根据需求调整
      success: (res) => {
        if (res.statusCode === 200) {
          // 请求成功：使用服务器返回的CSV数据
          this.parseCSV(res.data);
        } else {
          // 状态码非200：提示错误 + 使用示例数据兜底
          wx.showToast({
            title: `数据获取失败：${res.statusCode}`,
            icon: 'none',
            duration: 2000
          });
          this.useFallbackData();
        }
      },
      fail: (err) => {
        // 网络失败：提示错误 + 使用示例数据兜底
        wx.showToast({
          title: '网络请求失败',
          icon: 'none',
          duration: 2000
        });
        console.error('数据请求失败详情：', err);
        this.useFallbackData();
      },
      complete: () => {
        // 无论成功/失败，都隐藏加载提示
        wx.hideLoading();
      }
    });
  },
  
  // 新增：兜底数据方法（避免请求失败后无数据）
  useFallbackData() {
    const fallbackCsvData = `2026-03-15 10:56:41,20,59.7
    2026-03-15 10:56:45,20.1,58.3
    2026-03-15 10:56:47,20.1,57.8
    2026-03-15 10:56:49,20.2,57.5
    2026-03-15 10:56:51,20.2,57.1
    2026-03-15 10:56:53,20.2,56.8
    2026-03-15 10:56:55,20.3,56.6
    `;
    this.parseCSV(fallbackCsvData);
  },

  // 解析原始数据 → 存储原始数据 → 调用简化函数
  parseCSV(csvText) {
    const lines = csvText.split('\n');
    const rawData = [];

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      const parts = line.split(',');
      if (parts.length !== 3) continue;

      const [datetime, tempStr, humStr] = parts;
      const time = datetime.split(' ')[1];
      const timeShort = time.substring(0, 5);
      const [h, m, s] = time.split(':').map(Number);
      const timeHour = h + m/60 + s/3600;
      const temp = parseFloat(tempStr);
      const hum = parseFloat(humStr);

      if (!isNaN(temp) && !isNaN(hum) && !isNaN(timeHour)) {
        rawData.push({ time: timeShort, timeHour, temp, hum });
      }
    }

    // 排序并存储原始数据
    rawData.sort((a, b) => a.timeHour - b.timeHour);
    this.setData({ rawChartData: rawData }, () => {
      // 解析完成后自动简化数据
      this.simplifyData();
    });
  },

  // ====================== 基于数值变化的数据简化 ======================
  simplifyData() {
    const { rawChartData } = this.data;
    // 1. 简化参数配置（可根据需求调整）
    const config = {
      tempEpsilon: 0.1,  // 温度简化阈值（变化小于0.1℃的点会被合并）
      humEpsilon: 0.5,   // 湿度简化阈值（变化小于0.5%的点会被合并）
      minPoints: 5,      // 最少保留点数（避免简化后数据太少）
      maxPoints: 30      // 最多保留点数（避免数据过多）
    };

    // 2. 提取原始温度/湿度数据（格式：[{x:时间, y:数值}, ...]）
    const rawTemp = rawChartData.map(item => ({ x: item.timeHour, y: item.temp }));
    const rawHum = rawChartData.map(item => ({ x: item.timeHour, y: item.hum }));

    // 3. 调用Douglas-Peucker算法简化数据（核心算法）
    const simplifiedTemp = this.douglasPeucker(rawTemp, config.tempEpsilon);
    const simplifiedHum = this.douglasPeucker(rawHum, config.humEpsilon);

    // 4. 保证温度/湿度简化后时间点一致（取两者的并集，避免时间错位）
    const allTimes = [...new Set([...simplifiedTemp.map(p => p.x), ...simplifiedHum.map(p => p.x)])].sort((a, b) => a - b);

    // 5. 根据统一时间点提取简化后的数据（匹配原始数据的完整信息）
    const simplifiedData = allTimes.map(time => {
      const rawItem = rawChartData.find(item => Math.abs(item.timeHour - time) < 0.0001);
      return rawItem || rawChartData[0];
    });

    // 6. 边界处理：确保数据量在minPoints~maxPoints之间
    let finalData = simplifiedData;
    if (finalData.length < config.minPoints && rawChartData.length >= config.minPoints) {
      // 数据太少：按间隔抽样补充
      finalData = this.uniformSample(rawChartData, config.minPoints);
    } else if (finalData.length > config.maxPoints) {
      // 数据太多：按间隔抽样减少
      finalData = this.uniformSample(finalData, config.maxPoints);
    }

    // 7. 存储简化后的数据（用于绘图）
    this.setData({
      chartData: finalData,
      tempData: finalData.map(item => ({ time: item.time, timeHour: item.timeHour, value: item.temp })),
      humData: finalData.map(item => ({ time: item.time, timeHour: item.timeHour, value: item.hum }))
    }, () => {
      // 输出简化效果（控制台查看）
      console.log(`数据简化完成：原始${rawChartData.length}点 → 简化后${finalData.length}点`);
      this.drawChart();
    });
  },

  // ====================== 核心算法：Douglas-Peucker（基于数值变化简化） ======================
  /**
   * @param {Array} points - 原始数据点（[{x:时间, y:数值}, ...]）
   * @param {Number} epsilon - 简化阈值（越大简化越明显）
   * @return {Array} 简化后的数据点
   */
  douglasPeucker(points, epsilon) {
    if (points.length <= 2) return points; // 少于2个点，无需简化

    // 1. 找到距离最大的点（关键变化点）
    let maxDist = 0;
    let maxIndex = 0;
    const start = points[0];
    const end = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
      const dist = this.calcPointToLineDist(points[i], start, end);
      if (dist > maxDist) {
        maxDist = dist;
        maxIndex = i;
      }
    }

    // 2. 递归逻辑：距离大于阈值 → 保留该点，分割成两段继续简化；否则 → 丢弃中间点
    if (maxDist > epsilon) {
      const left = points.slice(0, maxIndex + 1);
      const right = points.slice(maxIndex);
      return [...this.douglasPeucker(left, epsilon), ...this.douglasPeucker(right, epsilon).slice(1)];
    } else {
      return [start, end]; // 只保留起点和终点
    }
  },

  // 辅助函数：计算点到线段的距离（判断数值变化大小的核心）
  calcPointToLineDist(point, start, end) {
    if (start.x === end.x) return Math.abs(point.x - start.x); // 垂直线
    // 线段方程：ax + by + c = 0
    const a = end.y - start.y;
    const b = start.x - end.x;
    const c = end.x * start.y - start.x * end.y;
    // 点到线段的距离公式
    return Math.abs(a * point.x + b * point.y + c) / Math.sqrt(a * a + b * b);
  },

  // 辅助函数：均匀抽样（处理边界情况）
  uniformSample(data, targetCount) {
    const step = Math.ceil(data.length / targetCount);
    const sampled = [];
    for (let i = 0; i < data.length; i += step) {
      sampled.push(data[i]);
    }
    // 确保最后一个点被保留
    if (sampled[sampled.length - 1] !== data[data.length - 1]) {
      sampled.push(data[data.length - 1]);
    }
    return sampled;
  },

  // ====================== 原有功能：图表初始化和绘制（不变） ======================
  initChart() {
    wx.createSelectorQuery().in(this).select('#dailyChart')
      .fields({ node: true, size: true }).exec(res => {
        if (!res[0]) return;
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getSystemInfoSync().pixelRatio;
        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        ctx.scale(dpr, dpr);
        this.setData({ dailyChart: { canvas, ctx, width: res[0].width, height: res[0].height } }, this.drawChart);
      });
  },

  drawChart() {
    const { dailyChart, tempData, humData } = this.data;
    if (!dailyChart || tempData.length < 2) return;

    const { ctx, width, height } = dailyChart;
    const leftPadding = 40;
    const rightPadding = 40;
    const chartWidth = width - leftPadding - rightPadding;
    const chartHeight = height - 40;
    const bottomPadding = 40;
    const xAxisY = height - bottomPadding;
    const rightAxisX = width - rightPadding;

    ctx.clearRect(0, 0, width, height);

    // 动态时间轴范围
    const allTimeHours = tempData.map(item => item.timeHour);
    const minTimeHour = Math.min(...allTimeHours);
    const maxTimeHour = Math.max(...allTimeHours);
    const timeDiff = maxTimeHour - minTimeHour;
    const safeTimeDiff = timeDiff === 0 ? 0.01 : timeDiff;

    // 双Y轴范围
    const values1 = tempData.map(i => i.value).filter(v => !isNaN(v));
    const values2 = humData.map(i => i.value).filter(v => !isNaN(v));
    const drawLine1 = values1.length >= 2;
    const drawLine2 = values2.length >= 2;

    const yMin1 = drawLine1 ? Math.min(...values1) - 0.5 : 19;
    const yMax1 = drawLine1 ? Math.max(...values1) + 0.5 : 21;
    const yMin2 = drawLine2 ? Math.min(...values2) - 2 : 55;
    const yMax2 = drawLine2 ? Math.max(...values2) + 2 : 61;

    // 绘制坐标轴
    ctx.beginPath();
    ctx.moveTo(leftPadding, xAxisY);
    ctx.lineTo(width - rightPadding, xAxisY);
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(leftPadding, 30);
    ctx.lineTo(leftPadding, xAxisY);
    ctx.strokeStyle = '#07c160';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(rightAxisX, 30);
    ctx.lineTo(rightAxisX, xAxisY);
    ctx.strokeStyle = '#007aff';
    ctx.stroke();

    // Y轴刻度
    const yTickCount = 5;
    for (let i = 0; i <= yTickCount; i++) {
      const y = 30 + (yTickCount - i) * (chartHeight - 30) / yTickCount;
      const tempVal = yMin1 + (i / yTickCount) * (yMax1 - yMin1);
      const humVal = yMin2 + (i / yTickCount) * (yMax2 - yMin2);

      // 温度刻度
      ctx.beginPath();
      ctx.moveTo(leftPadding, y);
      ctx.lineTo(leftPadding - 5, y);
      ctx.strokeStyle = '#07c160';
      ctx.stroke();
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#666';
      ctx.textAlign = 'right';
      ctx.fillText(tempVal.toFixed(1), leftPadding - 10, y + 4);

      // 湿度刻度
      ctx.beginPath();
      ctx.moveTo(rightAxisX, y);
      ctx.lineTo(rightAxisX + 5, y);
      ctx.strokeStyle = '#007aff';
      ctx.stroke();
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#666';
      ctx.textAlign = 'left';
      ctx.fillText(Math.round(humVal), rightAxisX + 10, y + 4);
    }

    // 动态X轴刻度
    const xTickCount = Math.min(5, tempData.length);
    const tickTimeStep = safeTimeDiff / xTickCount;
    for (let i = 0; i <= xTickCount; i++) {
      const tickTimeHour = minTimeHour + i * tickTimeStep;
      const tickHour = Math.floor(tickTimeHour);
      const tickMinute = Math.floor((tickTimeHour - tickHour) * 60);
      const tickTimeStr = `${String(tickHour).padStart(2, '0')}:${String(tickMinute).padStart(2, '0')}`;
      const xRatio = (tickTimeHour - minTimeHour) / safeTimeDiff;
      const x = leftPadding + xRatio * chartWidth;

      ctx.beginPath();
      ctx.moveTo(x, xAxisY);
      ctx.lineTo(x, xAxisY + 5);
      ctx.strokeStyle = '#ccc';
      ctx.stroke();
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#666';
      ctx.textAlign = 'center';
      ctx.fillText(tickTimeStr, x, xAxisY + 20);
    }

    // 绘制折线
    if (drawLine1) {
      ctx.beginPath();
      tempData.forEach((item, index) => {
        const xRatio = (item.timeHour - minTimeHour) / safeTimeDiff;
        const x = leftPadding + xRatio * chartWidth;
        const yRatio = (item.value - yMin1) / (yMax1 - yMin1);
        const y = 30 + (1 - yRatio) * (chartHeight - 30);
        index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#07c160';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    if (drawLine2) {
      ctx.beginPath();
      humData.forEach((item, index) => {
        const xRatio = (item.timeHour - minTimeHour) / safeTimeDiff;
        const x = leftPadding + xRatio * chartWidth;
        const yRatio = (item.value - yMin2) / (yMax2 - yMin2);
        const y = 30 + (1 - yRatio) * (chartHeight - 30);
        index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#007aff';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // 轴标签
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#07c160';
    ctx.textAlign = 'center';
    ctx.fillText('温度/℃', leftPadding, 15);
    ctx.fillStyle = '#007aff';
    ctx.fillText('湿度/%', rightAxisX, 15);
  },

  onUnload() {
    this.setData({ dailyChart: null });
  }
})