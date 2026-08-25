// pages/setpage/equalarm/equalarm.js
const app = getApp();
Page({
  /**
   * 页面的初始数据
   */
  data: {
    // // 滑块基础配置
    // sliderMin: 0,      // 滑块整体最小值
    // sliderMax: 100,    // 滑块整体最大值
    // step: 1,           // 步长（每次调整的最小单位）
    // 温度滑块专属范围（-40~85℃）
    tempSliderMin: -40,
    tempSliderMax: 85,
    tempStep: 5, // 新增：温度步长5
    tempMin: -20,       // 温度下限初始值（可自定义）
    tempMax: 60,        // 温度上限初始值（可自定义）
    tempLeftPercent: 0, // 温度左滑块百分比（初始化时计算）
    tempRightPercent: 0,// 温度右滑块百分比（初始化时计算）
    
    // 湿度滑块专属范围（0~100%，保持不变）
    humSliderMin: 0,
    humSliderMax: 100,
    humStep: 5,  // 新增：湿度步长5
    humMin: 30,         // 湿度下限初始值
    humMax: 70,         // 湿度上限初始值
    humLeftPercent: 30, // 湿度左滑块百分比
    humRightPercent: 70,// 湿度右滑块百分比
        
    // // 温度阈值
    // tempMin: 20,       // 温度下限
    // tempMax: 80,       // 温度上限
    // tempLeftPercent: 20,  // 温度左滑块百分比
    // tempRightPercent: 80, // 温度右滑块百分比
    
    // // 湿度阈值
    // humMin: 30,        // 湿度下限
    // humMax: 70,        // 湿度上限
    // humLeftPercent: 30,   // 湿度左滑块百分比
    // humRightPercent: 70,  // 湿度右滑块百分比
    
    // 触摸状态
    touchType: '',     // 当前触摸的滑块类型（min/max）
    currentThreshold: '', // 当前操作的阈值类型（temp/hum）
    trackWidth: 0,      // 滑块轨道宽度（用于计算）

    deviceId: '',
    fullUUID: '',
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 获取蓝牙设备ID（从跳转参数中获取）
    console.log(options);
    const fullUUID = options.fullUUID;
    const deviceId = options.deviceId;
    // 转数字 + 默认值：温度默认-20~60，湿度默认30~70
    const TempMin = Number(options.TempMin) || 0; 
    const TempMax = Number(options.TempMax) || 30;
    const HumMin = Number(options.HumMin) || 0;
    const HumMax = Number(options.HumMax) || 40;

    // 2. 计算温度滑块初始百分比（适配-40~85℃范围）
    const { tempSliderMin, tempSliderMax } = this.data;
    const tempRange = tempSliderMax - tempSliderMin; // 85 - (-40) = 125
    const tempLeftPercent = ((TempMin - tempSliderMin) / tempRange) * 100;
    const tempRightPercent = ((TempMax - tempSliderMin) / tempRange) * 100;

    // 3. 湿度百分比（范围0~100，直接用数值作为百分比）
    const humLeftPercent = HumMin;
    const humRightPercent = HumMax;
    this.setData({
        deviceId: deviceId,
        fullUUID: fullUUID,
        tempMin: TempMin,         // 已转为数字
        tempMax: TempMax,
        humMin: HumMin,           // 已转为数字
        humMax: HumMax,
        tempLeftPercent: tempLeftPercent, // 补充温度百分比
        tempRightPercent: tempRightPercent,
        humLeftPercent: humLeftPercent,
        humRightPercent: humRightPercent,
    });

    //     // 计算温度滑块初始百分比（核心：适配负数范围）
    // const { tempSliderMin, tempSliderMax, tempMin, tempMax } = this.data;
    // const tempRange = tempSliderMax - tempSliderMin; // 85 - (-40) = 125
    // const tempLeftPercent = ((tempMin - tempSliderMin) / tempRange) * 100;
    // const tempRightPercent = ((tempMax - tempSliderMin) / tempRange) * 100;

    // this.setData({
    //     tempLeftPercent,
    //     tempRightPercent
    // });
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {
    // 获取滑块轨道宽度，用于后续位置计算
    const query = wx.createSelectorQuery().in(this);
    query.select('.slider-track').boundingClientRect(rect => {
      this.setData({ trackWidth: rect.width });
    }).exec();
  },

  // 触摸开始事件
  onTouchStart(e) {
    if (!this.data.trackWidth) return;
    // 获取当前操作的阈值类型（temp/hum）
    const thresholdType = e.currentTarget.dataset.type || 'hum';
    const touch = e.touches[0];
    const trackLeft = e.currentTarget.offsetLeft;
    const touchX = touch.clientX - trackLeft;
    
    // 获取当前阈值的滑块位置
    const leftPercent = this.data[`${thresholdType}LeftPercent`];
    const rightPercent = this.data[`${thresholdType}RightPercent`];
    const leftPos = leftPercent / 100 * this.data.trackWidth;
    const rightPos = rightPercent / 100 * this.data.trackWidth;
    
    // 判断触摸的是左滑块还是右滑块
    const distanceToLeft = Math.abs(touchX - leftPos);
    const distanceToRight = Math.abs(touchX - rightPos);
    
    this.setData({
      currentThreshold: thresholdType,
      touchType: distanceToLeft < distanceToRight ? 'min' : 'max'
    });
  },
  onTouchMove(e) {
    if (!this.data.touchType || !this.data.trackWidth || !this.data.currentThreshold) return;
    
    const thresholdType = this.data.currentThreshold; // temp/hum
    const touch = e.touches[0];
    const trackLeft = e.currentTarget.offsetLeft;
    
    // 1. 计算触摸位置的百分比（0~100）
    let percent = ((touch.clientX - trackLeft) / this.data.trackWidth) * 100;
    percent = Math.max(0, Math.min(100, percent));
  
    // 2. 获取当前阈值类型的专属范围
    let sliderMin, sliderMax, minValue, maxValue, leftPercent, rightPercent;
    if (thresholdType === 'temp') {
      sliderMin = this.data.tempSliderMin;
      sliderMax = this.data.tempSliderMax;
      step = this.data.tempStep; // 取温度步长
      minValue = this.data.tempMin;
      maxValue = this.data.tempMax;
      leftPercent = this.data.tempLeftPercent;
      rightPercent = this.data.tempRightPercent;
    } else { // hum
      sliderMin = this.data.humSliderMin;
      sliderMax = this.data.humSliderMax;
      step = this.data.humStep; // 取湿度步长
      minValue = this.data.humMin;
      maxValue = this.data.humMax;
      leftPercent = this.data.humLeftPercent;
      rightPercent = this.data.humRightPercent;
    }
    const range = sliderMax - sliderMin; // 温度：125，湿度：100
  
    // 3. 按触摸类型更新数值（适配专属范围）
    let newLeftPercent = leftPercent;
    let newRightPercent = rightPercent;
    if (this.data.touchType === 'min') {
      // 下限不能超过上限（保留1%间隔）
      percent = Math.min(percent, rightPercent - 1);
      // 百分比转实际值：实际值 = 滑块最小值 + 百分比/100 * 范围
      minValue = sliderMin + (percent / 100) * range;
      minValue = Math.round(minValue / step) * step; // ✅ 步长5取整
      minValue = Math.max(sliderMin, Math.min(sliderMax, minValue)); // 限制范围
      newLeftPercent = ((minValue - sliderMin) / range) * 100; // 同步百分比
    //   minValue = Math.round(minValue); // 取整（避免小数）
    //   newLeftPercent = percent;
    } else {
      // 上限不能低于下限（保留1%间隔）
      percent = Math.max(percent, leftPercent + 1);
      // 百分比转实际值
      maxValue = sliderMin + (percent / 100) * range;
      maxValue = Math.round(maxValue / step) * step; // ✅ 步长5取整
      maxValue = Math.max(sliderMin, Math.min(sliderMax, maxValue)); // 限制范围
      newRightPercent = ((maxValue - sliderMin) / range) * 100; // 同步百分比
    //   maxValue = Math.round(maxValue);
    //   newRightPercent = percent;
    }
  
    // 4. 更新数据（按阈值类型区分）
    this.setData({
      [`${thresholdType}Min`]: minValue,
      [`${thresholdType}Max`]: maxValue,
      [`${thresholdType}LeftPercent`]: newLeftPercent,
      [`${thresholdType}RightPercent`]: newRightPercent
    });
  },
// // 替换原 onTouchMove 函数
// onTouchMove(e) {
//     if (!this.data.touchType || !this.data.trackWidth || !this.data.currentThreshold) return;
    
//     const thresholdType = this.data.currentThreshold; // 此时是 temp/hum，而非 undefined
//     const touch = e.touches[0];
//     const trackLeft = e.currentTarget.offsetLeft;
    
//     // 1. 计算触摸位置的百分比（限制 0~100）
//     let percent = ((touch.clientX - trackLeft) / this.data.trackWidth) * 100;
//     percent = Math.max(0, Math.min(100, percent));
    
//     // 2. 获取当前阈值的基础数据（✅ 确保变量名正确）
//     const leftPercent = this.data[`${thresholdType}LeftPercent`];
//     const rightPercent = this.data[`${thresholdType}RightPercent`];
//     let minValue = this.data[`${thresholdType}Min`];
//     let maxValue = this.data[`${thresholdType}Max`];
//     let newLeftPercent = leftPercent;
//     let newRightPercent = rightPercent;
    
//     // 3. 按触摸类型更新数值（✅ 修复数值计算逻辑）
//     if (this.data.touchType === 'min') {
//       // 下限不能超过上限（保留 1% 间隔避免重叠）
//       percent = Math.min(percent, rightPercent - 1);
//       // 转换为实际数值（0~100 百分比对应 sliderMin~sliderMax）
//       minValue = Math.round(percent / 100 * (this.data.sliderMax - this.data.sliderMin)) * this.data.step;
//       minValue = Math.max(this.data.sliderMin, Math.min(this.data.sliderMax, minValue));
//       newLeftPercent = (minValue / (this.data.sliderMax - this.data.sliderMin)) * 100;
//     } else {
//       // 上限不能低于下限（保留 1% 间隔）
//       percent = Math.max(percent, leftPercent + 1);
//       // 转换为实际数值
//       maxValue = Math.round(percent / 100 * (this.data.sliderMax - this.data.sliderMin)) * this.data.step;
//       maxValue = Math.max(this.data.sliderMin, Math.min(this.data.sliderMax, maxValue));
//       newRightPercent = (maxValue / (this.data.sliderMax - this.data.sliderMin)) * 100;
//     }
    
//     // 4. 更新数据
//     this.setData({
//       [`${thresholdType}Min`]: minValue,
//       [`${thresholdType}Max`]: maxValue,
//       [`${thresholdType}LeftPercent`]: newLeftPercent,
//       [`${thresholdType}RightPercent`]: newRightPercent
//     });
//   },

  /**
   * 字符串转ArrayBuffer（复用昵称设置的转换逻辑）
   */
  stringToBuffer(str) {
    let codePoints = [];
    for (let i = 0; i < str.length; i++) {
      let charCode = str.charCodeAt(i);
      if (charCode < 0x80) {
        codePoints.push(charCode);
      } else if (charCode < 0x800) {
        codePoints.push(0xc0 | (charCode >> 6));
        codePoints.push(0x80 | (charCode & 0x3f));
      } else if (charCode < 0x10000) {
        codePoints.push(0xe0 | (charCode >> 12));
        codePoints.push(0x80 | ((charCode >> 6) & 0x3f));
        codePoints.push(0x80 | (charCode & 0x3f));
      } else {
        codePoints.push(0xf0 | (charCode >> 18));
        codePoints.push(0x80 | ((charCode >> 12) & 0x3f));
        codePoints.push(0x80 | ((charCode >> 6) & 0x3f));
        codePoints.push(0x80 | (charCode & 0x3f));
      }
    }
    const buffer = new ArrayBuffer(codePoints.length);
    const uint8Array = new Uint8Array(buffer);
    for (let i = 0; i < codePoints.length; i++) {
      uint8Array[i] = codePoints[i];
    }
    return buffer;
  },

  /**
   * 保存阈值并发送到ESP32
   */
  saveThreshold() {
    const { deviceId, tempMax, tempMin, humMax, humMin } = this.data;
    
    // 验证设备ID
    if (!deviceId) {
      return wx.showToast({ title: '设备ID为空', icon: 'none' });
    }
    
    // 验证阈值合理性
    if (tempMin >= tempMax || humMin >= humMax) {
      return wx.showToast({ title: '下限不能大于等于上限', icon: 'none' });
    }

    wx.showLoading({ title: '保存阈值中...', mask: true });

    // 1. 构造温度阈值指令（格式：TEMP:上限,下限）
    const tempMsg = `TEMP:${tempMax},${tempMin}`;
    const tempBuffer = this.stringToBuffer(tempMsg);
    
    // 2. 构造湿度阈值指令（格式：HUM:上限,下限）
    const humMsg = `HUM:${humMax},${humMin}`;
    const humBuffer = this.stringToBuffer(humMsg);

    // 发送蓝牙数据的通用方法
    const sendBLEData = (buffer, type) => {
      wx.writeBLECharacteristicValue({
        deviceId,
        // 复用WiFi/昵称配置的蓝牙服务ID和特征值ID（根据实际硬件调整）
        serviceId: "74685301-2022-2026-0114-6D2B8A3F9E1C",
        characteristicId: "BEB5483E-36E1-4688-B7F5-EA07361B26A8",
        value: buffer,
        fail: (err) => {
          wx.hideLoading();
          console.error(`${type}阈值发送失败`, err);
          wx.showToast({ title: `${type}发送失败`, icon: 'error' });
        }
      });
    };

    // 先发送温度阈值，再发送湿度阈值（可根据需要调整发送顺序）
    sendBLEData(tempBuffer, '温度');
    setTimeout(() => {
      sendBLEData(humBuffer, '湿度');
    }, 300);

    // 监听ESP32的蓝牙回调
    wx.onBLECharacteristicValueChange((res) => {
      const value = String.fromCharCode.apply(null, new Uint8Array(res.value));
      console.log('收到ESP32返回:', value);

      // 处理温度阈值回调
      if (value.startsWith("TEMP_OK")) {
        wx.showToast({ title: '温度阈值保存成功', icon: 'success' });
      } else if (value === "TEMP_FORMAT_ERR") {
        wx.showToast({ title: '温度阈值格式错误', icon: 'error' });
      }

      // 处理湿度阈值回调
      if (value.startsWith("HUM_OK")) {
        wx.hideLoading();
        wx.showToast({ title: '湿度阈值保存成功', icon: 'success' });
        // 延迟返回上一页，保证用户看到提示
        setTimeout(() => wx.navigateBack(), 1500);
      } else if (value === "HUM_FORMAT_ERR") {
        wx.hideLoading();
        wx.showToast({ title: '湿度阈值格式错误', icon: 'error' });
      }
    });
  },

  // 其他生命周期函数保持不变
  onShow() {},
  onHide() {},
  onUnload() {},
  onPullDownRefresh() {},
  onReachBottom() {},
  onShareAppMessage() {}
})