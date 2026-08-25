// pages/detailed/detailed.js
const app = getApp();
Page({

  /**
   * 页面的初始数据
   */
  data: {
    fullUUID: " ",
    deviceId:" ",
    equID:" ",
    equNAME: " ",
    thisDevices:null,
    updateInterval: null, // 用于存储定时器ID

    halfHourRange: 1,
    halfHourData: [],
    secondHalfHourData: [],
    halfHourChart: null,
    randomTimer: null,
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.startAutoUpdate();
    // options 包含了所有传递过来的参数
    console.log(options);
    const fullUUID = options.fullUUID;
    const deviceId = options.deviceId;
    const equName = decodeURIComponent(options.equNAME);
    const header = fullUUID.substring(0, 8);
    const footer = fullUUID.substring(24);
    this.setData({
      fullUUID: fullUUID,
      deviceId: deviceId,
      equNAME: equName,
      equID: `${header}-${footer}`,
    });

    // this.setData({
    //     thisDevices:app.globalData.SaveSelectedList,
    // });

    this.selectDeviceById(this.data.deviceId);
    
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {
    this.initHalfHourChart();
    this.startDataGenerators();
    
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    if (this.data.thisDevices.IsOnline==false) {
        wx.showToast({
            icon:'error',
            title: '设备离线'
          });
    }
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {
    if (this.data.updateInterval) {
        clearInterval(this.data.updateInterval);
      }
    if (this.data.randomTimer) clearInterval(this.data.randomTimer);
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  },

  startAutoUpdate: function() {
    // 每隔5000毫秒（5秒）调用一次 selectDeviceById 函数
    const now = new Date();
    const intervalId = setInterval(() => {
    //   this.updateGetdate();
    this.selectDeviceById(this.data.deviceId);
    }, 1000);
    const hours = now.getHours();        // 获取小时 (0-23)
    const minutes = now.getMinutes();    // 获取分钟 (0-59)
    this.setData({
      updateInterval: intervalId
    });
    
  },

//   updateGetdate: function() {
//     this.setData({
//         thisDevices:app.globalData.SaveSelectedList,
//     });
//   },

  /**
   * 根据 ID 筛选设备
   * @param {number} id - 要筛选的设备ID
   */
  selectDeviceById: function(id) {
    // 使用 find() 方法查找ID匹配的设备
    const device = app.globalData.SaveSelectedList.find(item => item.deviceId === id);
    if (device) {
      //console.log('刷新数据',device);
      // 将整个设备对象存入页面 data
      this.setData({
        thisDevices: device
      });
    }
  },

  /**
   * 点击设置按键项跳转到详情页
   * @param {Object} event 事件对象
   */
  opensetpage: function(event) {
    console.log(event);
    const fullUUIDto = event.currentTarget.dataset.fulluuid;
    const deviceIdto = event.currentTarget.dataset.deviceid;
    const equNAMEto = event.currentTarget.dataset.equname;
    wx.navigateTo({
      url: '/pages/setpage/setpage?fullUUID='+fullUUIDto+'&deviceId='+deviceIdto+'&equNAME='+equNAMEto,
    });
  },

  opendaily: function(event) {
    console.log(event);
    const fullUUIDto = event.currentTarget.dataset.fulluuid;
    const deviceIdto = event.currentTarget.dataset.deviceid;
    const equNAMEto = event.currentTarget.dataset.equname;
    wx.navigateTo({
      url: '/pages/detailed/detaileddaily/detaileddaily?fullUUID='+fullUUIDto+'&deviceId='+deviceIdto+'&equNAME='+equNAMEto,
    });
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

  startDataGenerators() {
    const randomTimer = setInterval(() => this.generateRandomData(), 1000);
    this.setData({ randomTimer});
    this.generateRandomData();
  },

  generateRandomData() {
    const { halfHourData, secondHalfHourData, halfHourRange } = this.data;
    const now = new Date();
    
    const value1 = this.data.thisDevices.equTEMP;
    const value2 = this.data.thisDevices.equHUM;
    const newData1 = { time: now, value: value1 };
    // 第二条折线新数据（时间与第一条完全一致）
    const newData2 = { time: now, value: value2 };

    // 过滤超出时间范围的数据（30分钟）
    const rangeMs = halfHourRange * 60 * 1000;
    const filteredData1 = [...halfHourData, newData1].filter(item => now.getTime() - item.time.getTime() <= rangeMs);
    const filteredData2 = [...secondHalfHourData, newData2].filter(item => now.getTime() - item.time.getTime() <= rangeMs);

    // 同时更新两条折线的数据
    this.setData({
      halfHourData: filteredData1,
      secondHalfHourData: filteredData2
    }, () => {
      this.drawHalfHourChart();
    });
  },

 /**
 * 绘制半小时折线图（双Y轴：左轴绿色，右轴蓝色）
 */
drawHalfHourChart() {
    const { halfHourChart, halfHourData, secondHalfHourData, halfHourRange } = this.data;
    if (!halfHourChart) return;
  
    const { canvas, ctx, width, height } = halfHourChart;
    // 调整布局：左padding=40，右padding=60（给右轴留空间）
    const leftPadding = 40;
    const rightPadding = 40;
    const chartWidth = width - leftPadding - rightPadding; // 图表实际宽度（扣除左右轴）
    const chartHeight = height - 40; // 上下padding=20，简化计算
    const bottomPadding = 40; // 底部padding（X轴标签）
  
    // 清空画布
    ctx.clearRect(0, 0, width, height);
  
    // 1. 分离计算两条折线的Y轴范围（关键：互不干扰）
    // 左轴（绿色折线）范围
    const values1 = halfHourData.map(item => item.value).filter(v => v !== undefined);
    // 右轴（蓝色折线）范围
    const values2 = secondHalfHourData.map(item => item.value).filter(v => v !== undefined);
    
    // 至少各有2个点才绘制对应折线
    const drawLine1 = values1.length >= 2;
    const drawLine2 = values2.length >= 2;
    if (!drawLine1 && !drawLine2) return;
  
    // 左轴Y范围（绿色）
    const yMin1 = drawLine1 ? Math.min(...values1) - 5 : 0;
    const yMax1 = drawLine1 ? Math.max(...values1) + 5 : 35;
    // 右轴Y范围（蓝色）
    const yMin2 = drawLine2 ? Math.min(...values2) - 5 : 0;
    const yMax2 = drawLine2 ? Math.max(...values2) + 5 : 35;
  
    const now = new Date();
  
    // 2. 绘制坐标轴基础（X轴 + 左/右Y轴）
    // 绘制X轴（从左轴到右轴）
    ctx.beginPath();
    const xAxisY = height - bottomPadding; // X轴Y坐标
    ctx.moveTo(leftPadding, xAxisY); 
    ctx.lineTo(width - rightPadding, xAxisY); // X轴终点到右轴左侧
    ctx.strokeStyle = '#ccc'; 
    ctx.lineWidth = 1; 
    ctx.stroke();
  
    // 绘制左Y轴（绿色折线）
    ctx.beginPath();
    ctx.moveTo(leftPadding, 30); // 顶部padding=20
    ctx.lineTo(leftPadding, xAxisY);
    ctx.strokeStyle = '#07c160'; // 左轴颜色匹配绿色折线
    ctx.stroke();
  
    // 绘制右Y轴（蓝色折线）
    ctx.beginPath();
    const rightAxisX = width - rightPadding; // 右轴X坐标
    ctx.moveTo(rightAxisX, 30);
    ctx.lineTo(rightAxisX, xAxisY);
    ctx.strokeStyle = '#007aff'; // 右轴颜色匹配蓝色折线
    ctx.stroke();
  
    // 3. 绘制左Y轴刻度（绿色折线）
    const yTickCount = 5;
    for (let i = 0; i <= yTickCount; i++) {
      const y = 30 + (yTickCount - i) * (chartHeight - 30) / yTickCount; // 从顶部到底部
      const value = yMin1 + (i / yTickCount) * (yMax1 - yMin1);
      
      // 刻度线（向左轴内侧绘制）
      ctx.beginPath();
      ctx.moveTo(leftPadding, y);
      ctx.lineTo(leftPadding - 5, y); // 左轴刻度短线（向左）
      ctx.strokeStyle = '#07c160';
      ctx.stroke();
  
      // 刻度文本（左对齐）
      ctx.font = '12px sans-serif'; 
      ctx.fillStyle = '#666'; 
      ctx.textAlign = 'right'; // 文本右对齐，贴左轴
      ctx.fillText(Math.round(value), leftPadding - 10, y + 4);
    }
  
    // 4. 绘制右Y轴刻度（蓝色折线）
    for (let i = 0; i <= yTickCount; i++) {
      const y = 30 + (yTickCount - i) * (chartHeight - 30) / yTickCount;
      const value = yMin2 + (i / yTickCount) * (yMax2 - yMin2);
      
      // 刻度线（向右轴内侧绘制）
      ctx.beginPath();
      ctx.moveTo(rightAxisX, y);
      ctx.lineTo(rightAxisX + 5, y); // 右轴刻度短线（向右）
      ctx.strokeStyle = '#007aff';
      ctx.stroke();
  
      // 刻度文本（右对齐）
      ctx.font = '12px sans-serif'; 
      ctx.fillStyle = '#666'; 
      ctx.textAlign = 'left'; // 文本左对齐，贴右轴
      ctx.fillText(Math.round(value), rightAxisX + 10, y + 4);
    }
  
    // 5. 绘制X轴固定刻度（30min、25min...5min，不变）
    const xLabels = ['60s', '50s', '40s', '30s', '20s', '10s','0s'];
    const labelCount = xLabels.length;
    const labelStep = chartWidth / (labelCount - 1);
    
    xLabels.forEach((label, index) => {
      const x = leftPadding + index * labelStep;
      // 刻度短线
      ctx.beginPath();
      ctx.moveTo(x, xAxisY);
      ctx.lineTo(x, xAxisY + 5);
      ctx.strokeStyle = '#ccc';
      ctx.stroke();
      // 刻度文本
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#666';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, xAxisY + 20);
    });
  
    // 6. 绘制第一条折线（绿色，基于左轴）
    if (drawLine1) {
      ctx.beginPath();
      halfHourData.forEach((item, index) => {
        // X坐标（不变，基于时间差）
        const timeDiffMs = now.getTime() - item.time.getTime();
        const timeDiffMin = timeDiffMs / (1000 * 60);
        const xRatio = Math.max(0, Math.min(1, timeDiffMin / halfHourRange)); 
        const x = leftPadding + (1 - xRatio) * chartWidth;
        
        // Y坐标（基于左轴范围计算）
        const yRatio = (item.value - yMin1) / (yMax1 - yMin1);
        const y = 20 + (1 - yRatio) * (chartHeight - 20); // 反向映射（值越大，Y越靠上）
        
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#07c160'; 
      ctx.lineWidth = 3; 
      ctx.stroke();
    }
  
    //绘制第二条折线（蓝色）
    if (drawLine2) {
      ctx.beginPath();
      secondHalfHourData.forEach((item, index) => {
        // X坐标（与第一条完全一致，时间对齐）
        const timeDiffMs = now.getTime() - item.time.getTime();
        const timeDiffMin = timeDiffMs / (1000 * 60);
        const xRatio = Math.max(0, Math.min(1, timeDiffMin / halfHourRange)); 
        const x = leftPadding + (1 - xRatio) * chartWidth;
        
        // Y坐标（基于右轴范围计算）
        const yRatio = (item.value - yMin2) / (yMax2 - yMin2);
        const y = 20 + (1 - yRatio) * (chartHeight - 20);
        
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#007aff'; 
      ctx.lineWidth = 3; 
      ctx.stroke();
    }
    // 左轴标签
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#07c160';
    ctx.textAlign = 'center';
    ctx.fillText('温度/℃', leftPadding, 15); // 左轴顶部

    // 右轴标签
    ctx.fillStyle = '#007aff';
    ctx.fillText('湿度/%', rightAxisX, 15); // 右轴顶部
    },

  changeTimeRange(e) {
    const range = parseInt(e.currentTarget.dataset.range);
    this.setData({ halfHourRange: range }, () => this.generateRandomData());
  }
})