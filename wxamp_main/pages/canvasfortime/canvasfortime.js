// pages/chartPage/chartPage.js
Page({
    data: {
      halfHourRange: 30,
      halfHourData: [],
      halfHourChart: null,
      dayData: Array(1440).fill(null),
      dayChart: null,
      randomTimer: null,
      dayUpdateTimer: null
    },
  
    onReady() {
      this.initHalfHourChart();
      this.initDayChart();
      this.startDataGenerators();
    },
  
    onUnload() {
      if (this.data.randomTimer) clearInterval(this.data.randomTimer);
      if (this.data.dayUpdateTimer) clearInterval(this.data.dayUpdateTimer);
    },
  
    initHalfHourChart() {
      const query = wx.createSelectorQuery().in(this);
      query.select('#halfHourChart')
        .fields({ node: true, size: true })
        .exec(res => {
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          const dpr = wx.getSystemInfoSync().pixelRatio;
          canvas.width = res[0].width * dpr;
          canvas.height = res[0].height * dpr;
          ctx.scale(dpr, dpr);
          this.setData({
            halfHourChart: { canvas, ctx, width: res[0].width, height: res[0].height }
          }, () => this.drawHalfHourChart());
        });
    },
  
    initDayChart() {
      const query = wx.createSelectorQuery().in(this);
      query.select('#dayChart')
        .fields({ node: true, size: true })
        .exec(res => {
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          const dpr = wx.getSystemInfoSync().pixelRatio;
          canvas.width = res[0].width * dpr;
          canvas.height = res[0].height * dpr;
          ctx.scale(dpr, dpr);
          this.setData({
            dayChart: { canvas, ctx, width: res[0].width, height: res[0].height }
          }, () => this.drawDayChart());
        });
    },
  
    startDataGenerators() {
      const randomTimer = setInterval(() => this.generateRandomData(), 1000);
      const dayUpdateTimer = setInterval(() => this.updateDayChart(), 60000);
      this.setData({ randomTimer, dayUpdateTimer });
      this.generateRandomData();
      this.updateDayChart();
    },
  
    generateRandomData() {
      const { halfHourData, halfHourRange } = this.data;
      const now = new Date();
      const value = Math.floor(Math.random() * 20) + 10;
      const newData = { time: now, value: value };
      const rangeMs = halfHourRange * 60 * 1000;
      const filteredData = [...halfHourData, newData].filter(item => now.getTime() - item.time.getTime() <= rangeMs);
      this.setData({ halfHourData: filteredData }, () => this.drawHalfHourChart());
    },
  
    updateDayChart() {
      const { dayData } = this.data;
      const now = new Date();
      const minuteOfDay = now.getHours() * 60 + now.getMinutes();
      const value = Math.floor(Math.random() * 20) + 10;
      const newDayData = [...dayData];
      newDayData[minuteOfDay] = value;
      this.setData({ dayData: newDayData }, () => this.drawDayChart());
    },
  
    /**
     * 绘制半小时折线图 (已移除数据点)
     */
    drawHalfHourChart() {
      const { halfHourChart, halfHourData } = this.data;
      if (!halfHourChart || halfHourData.length < 2) return; // 至少需要2个点才能画折线
  
      const { canvas, ctx, width, height } = halfHourChart;
      const padding = 40;
      const chartWidth = width - 2 * padding;
      const chartHeight = height - 2 * padding;
      
      ctx.clearRect(0, 0, width, height);
      
      const values = halfHourData.map(item => item.value);
      const yMin = Math.min(...values) - 5;
      const yMax = Math.max(...values) + 5;
      
      // 绘制坐标轴和网格
      ctx.beginPath();
      ctx.moveTo(padding, padding); ctx.lineTo(padding, padding + chartHeight); ctx.lineTo(padding + chartWidth, padding + chartHeight);
      ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1; ctx.stroke();
      
      const yTickCount = 5;
      for (let i = 0; i <= yTickCount; i++) {
        const y = padding + chartHeight - (i / yTickCount) * chartHeight;
        const value = yMin + (i / yTickCount) * (yMax - yMin);
        ctx.font = '12px sans-serif'; ctx.fillStyle = '#666'; ctx.textAlign = 'right'; ctx.fillText(Math.round(value), padding - 10, y + 4);
        ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(padding + chartWidth, y); ctx.strokeStyle = '#f0f0f0'; ctx.stroke();
      }
      
      const maxPoints = 6;
      const step = Math.max(1, Math.floor(halfHourData.length / maxPoints));
      halfHourData.forEach((item, index) => {
        if (index % step === 0 || index === halfHourData.length - 1) {
          const x = padding + (index / (halfHourData.length - 1)) * chartWidth;
          const timeStr = item.time.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' });
          ctx.font = '12px sans-serif'; ctx.fillStyle = '#666'; ctx.textAlign = 'center'; ctx.fillText(timeStr, x, padding + chartHeight + 20);
        }
      });
      
      // 绘制折线 (核心部分)
      ctx.beginPath();
      halfHourData.forEach((item, index) => {
        const x = padding + (index / (halfHourData.length - 1)) * chartWidth;
        const y = padding + chartHeight - ((item.value - yMin) / (yMax - yMin) * chartHeight);
        if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#07c160'; ctx.lineWidth = 3; ctx.stroke(); // 加粗线条使其更明显
    },
  
    /**
     * 绘制日折线图 (已移除数据点)
     */
    drawDayChart() {
      const { dayChart, dayData } = this.data;
      if (!dayChart) return;
  
      const { canvas, ctx, width, height } = dayChart;
      const padding = 40;
      const chartWidth = width - 2 * padding;
      const chartHeight = height - 2 * padding;
      
      ctx.clearRect(0, 0, width, height);
      
      const validData = dayData.filter(value => value !== null);
      if (validData.length < 2) return; // 至少需要2个点才能画折线
  
      const yMin = Math.min(...validData) - 5;
      const yMax = Math.max(...validData) + 5;
      
      // 绘制坐标轴和网格
      ctx.beginPath();
      ctx.moveTo(padding, padding); ctx.lineTo(padding, padding + chartHeight); ctx.lineTo(padding + chartWidth, padding + chartHeight);
      ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1; ctx.stroke();
      
      const yTickCount = 5;
      for (let i = 0; i <= yTickCount; i++) {
        const y = padding + chartHeight - (i / yTickCount) * chartHeight;
        const value = yMin + (i / yTickCount) * (yMax - yMin);
        ctx.font = '12px sans-serif'; ctx.fillStyle = '#666'; ctx.textAlign = 'right'; ctx.fillText(Math.round(value), padding - 10, y + 4);
        ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(padding + chartWidth, y); ctx.strokeStyle = '#f0f0f0'; ctx.stroke();
      }
      
      for (let i = 0; i <= 24; i += 4) {
        const x = padding + (i / 24) * chartWidth;
        ctx.font = '12px sans-serif'; ctx.fillStyle = '#666'; ctx.textAlign = 'center'; ctx.fillText(`${i}:00`, x, padding + chartHeight + 20);
      }
      
      // 绘制折线 (核心部分)
      ctx.beginPath();
      let firstPoint = true;
      dayData.forEach((value, minute) => {
        if (value === null) return;
        const hour = minute / 60;
        const x = padding + (hour / 24) * chartWidth;
        const y = padding + chartHeight - ((value - yMin) / (yMax - yMin) * chartHeight);
        if (firstPoint) { ctx.moveTo(x, y); firstPoint = false; } else { ctx.lineTo(x, y); }
      });
      ctx.strokeStyle = '#ff7d00'; ctx.lineWidth = 3; ctx.stroke(); // 加粗线条使其更明显
    },
  
    changeTimeRange(e) {
      const range = parseInt(e.currentTarget.dataset.range);
      this.setData({ halfHourRange: range }, () => this.generateRandomData());
    }
  });