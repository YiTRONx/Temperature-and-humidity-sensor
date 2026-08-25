// pages/setpage/otherset/otherset.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    deviceId: '',
    fullUUID: '',

    refreshSelectDate: "",
    selectedRefreshTime:0,// 默认选中的刷新频率时间
    refreshList:["0.1s","0.5s","1s","2s","5s","10s","15s","30s"],
    refreshTimeList: [0.1,0.5,1,2,5,10,15,30], // 可选刷新频率（单位：秒，可自定义）
    
    screenSelectDate: "",
    screenList:["不熄屏","1s","5s","10s","30s","60s","5min","10min","30min"],
    screenTimeList: [0,1,5,10,30,60,300,600,1800], // 可选熄屏时间（单位：秒，可自定义）
    selectedScreenTime: 0,// 默认选中的熄屏时间

  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 获取蓝牙设备ID（从跳转参数中获取）
    console.log(options);
    const fullUUID = options.fullUUID;
    const deviceId = options.deviceId;
    const RefreshTime = Number(options.RefreshTime)/1000; 
    const ScreenTime = Number(options.ScreenTime)/1000;
    const RefreshIndex = this.data.refreshTimeList.indexOf(RefreshTime);
    const ScreenIndex = this.data.screenTimeList.indexOf(ScreenTime);
    if(RefreshIndex === -1) {RefreshIndex = 3};
    if(ScreenIndex === -1) {ScreenIndex = 0};
    this.setData({
        deviceId: deviceId,
        fullUUID: fullUUID,
        selectedRefreshTime: RefreshIndex,
        selectedScreenTime: ScreenIndex,
    })
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

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


  onRefreshChange(e) {
    const index = e.detail.value;
    const refreshSelectDate = this.data.refreshTimeList[index];
    this.setData({
      selectedRefreshTime: index,
      refreshSelectDate
    }, () => {
    //   this.loadLocalData(); // 重新加载数据
        this.confirmRefreshTime();
    });
  },

  onScreenChange(e) {
    const index = e.detail.value;
    const screenSelectDate = this.data.screenTimeList[index];
    this.setData({
      selectedScreenTime: index,
      screenSelectDate
    }, () => {
    //   this.loadLocalData(); // 重新加载数据
        this.confirmScreenTime();
    });
  },


  // 确认选择并发送蓝牙指令
  confirmScreenTime() {
    const { selectedScreenTime, deviceId, fullUUID } = this.data;
    const screenSelectDate = this.data.screenTimeList[selectedScreenTime]*1000;
    // 校验设备信息
    if (!deviceId || !fullUUID) {
      wx.showToast({
        title: '设备信息缺失',
        icon: 'none',
      });
      return;
    }
    // 构造昵称配置指令（格式参考WiFi的指令逻辑）
    const msg = `SCREEN:${screenSelectDate}`;
    const buffer = this.stringToBuffer(msg);

    // 发送BLE数据到设备
    wx.writeBLECharacteristicValue({
      deviceId,
      // 复用WiFi配置的serviceId/characteristicId（可根据实际硬件逻辑调整）
      serviceId: "74685301-2022-2026-0114-6D2B8A3F9E1C",
      characteristicId: "BEB5483E-36E1-4688-B7F5-EA07361B26A8",
      value: buffer,
      fail: (err) => {
        wx.hideLoading();
        console.error('配置发送失败', err);
        wx.showToast({ title: '发送失败', icon: 'error' });
      }
    });
    wx.showLoading({ title: '保存中...', mask: true });

    // 监听设备的BLE特征值变化反馈
    wx.onBLECharacteristicValueChange((res) => {
      const value = String.fromCharCode.apply(null, new Uint8Array(res.value));
      // 设备端需对应返回 NICK_OK/NICK_FAIL 标识
      if (value === "SCREEN_OK") {
        wx.hideLoading();
        wx.showToast({ title: '保存成功' });
      } else if (value === "SCREEN_FAIL") {
        wx.hideLoading();
        wx.showModal({ title: '失败', content: '保存失败，请重试', showCancel: false });
      }
    });
    // 拆分serviceId和characteristicId（和硬件约定的UUID格式）
    const [serviceId, characteristicId] = fullUUID.split(',');
    if (!serviceId || !characteristicId) {
      wx.showToast({
        title: 'UUID格式错误',
        icon: 'none',
      });
      return;
    }
  },

  // 确认选择并发送蓝牙指令
  confirmRefreshTime() {
    const { selectedRefreshTime, deviceId, fullUUID } = this.data;
    const refreshSelectDate = this.data.refreshTimeList[selectedRefreshTime]*1000;
    // 校验设备信息
    if (!deviceId || !fullUUID) {
      wx.showToast({
        title: '设备信息缺失',
        icon: 'none',
      });
      return;
    }
    // 构造昵称配置指令（格式参考WiFi的指令逻辑）
    const msg = `REFRESH:${refreshSelectDate}`;
    const buffer = this.stringToBuffer(msg);

    // 发送BLE数据到设备
    wx.writeBLECharacteristicValue({
      deviceId,
      // 复用WiFi配置的serviceId/characteristicId（可根据实际硬件逻辑调整）
      serviceId: "74685301-2022-2026-0114-6D2B8A3F9E1C",
      characteristicId: "BEB5483E-36E1-4688-B7F5-EA07361B26A8",
      value: buffer,
      fail: (err) => {
        wx.hideLoading();
        console.error('配置发送失败', err);
        wx.showToast({ title: '发送失败', icon: 'error' });
      }
    });
    wx.showLoading({ title: '保存中...', mask: true });

    // 监听设备的BLE特征值变化反馈
    wx.onBLECharacteristicValueChange((res) => {
      const value = String.fromCharCode.apply(null, new Uint8Array(res.value));
      // 设备端需对应返回 NICK_OK/NICK_FAIL 标识
      if (value === "REFRESH_OK") {
        wx.hideLoading();
        wx.showToast({ title: '保存成功' });
      } else if (value === "REFRESH_FAIL") {
        wx.hideLoading();
        wx.showModal({ title: '失败', content: '保存失败，请重试', showCancel: false });
      }
    });
    // 拆分serviceId和characteristicId（和硬件约定的UUID格式）
    const [serviceId, characteristicId] = fullUUID.split(',');
    if (!serviceId || !characteristicId) {
      wx.showToast({
        title: 'UUID格式错误',
        icon: 'none',
      });
      return;
    }
  },



      /**
     * 字符串转ArrayBuffer（和WiFi配置复用同个转换方法）
     */
 stringToBuffer(str) {
    // 手动实现 UTF-8 编码：将字符串转为 UTF-8 字节数组
    let codePoints = [];
    for (let i = 0; i < str.length; i++) {
      let charCode = str.charCodeAt(i);
      // 单字节（ASCII）
      if (charCode < 0x80) {
        codePoints.push(charCode);
      } 
      // 双字节
      else if (charCode < 0x800) {
        codePoints.push(0xc0 | (charCode >> 6));
        codePoints.push(0x80 | (charCode & 0x3f));
      } 
      // 三字节（中文）
      else if (charCode < 0x10000) {
        codePoints.push(0xe0 | (charCode >> 12));
        codePoints.push(0x80 | ((charCode >> 6) & 0x3f));
        codePoints.push(0x80 | (charCode & 0x3f));
      } 
      // 四字节（极少用，如特殊符号）
      else {
        codePoints.push(0xf0 | (charCode >> 18));
        codePoints.push(0x80 | ((charCode >> 12) & 0x3f));
        codePoints.push(0x80 | ((charCode >> 6) & 0x3f));
        codePoints.push(0x80 | (charCode & 0x3f));
      }
    }
    // 将字节数组转为 ArrayBuffer
    const buffer = new ArrayBuffer(codePoints.length);
    const uint8Array = new Uint8Array(buffer);
    for (let i = 0; i < codePoints.length; i++) {
      uint8Array[i] = codePoints[i];
    }
    return buffer;
  },

  CLEARCLEARCLEAR(){
    const {deviceId, fullUUID } = this.data;
    wx.showModal({
        title: '确认清除',
        content: '确定要清除该设备的配置吗？',
        success: (res) => {
            // 校验设备信息
            if (!deviceId || !fullUUID) {
            wx.showToast({
                title: '设备信息缺失',
                icon: 'none',
            });
            return;
            }
            // 构造昵称配置指令（格式参考WiFi的指令逻辑）
            const msg = `CLEAR`;
            const buffer = this.stringToBuffer(msg);

            // 发送BLE数据到设备
            wx.writeBLECharacteristicValue({
            deviceId,
            // 复用WiFi配置的serviceId/characteristicId（可根据实际硬件逻辑调整）
            serviceId: "74685301-2022-2026-0114-6D2B8A3F9E1C",
            characteristicId: "BEB5483E-36E1-4688-B7F5-EA07361B26A8",
            value: buffer,
            fail: (err) => {
                wx.hideLoading();
                console.error('清除指令发送失败', err);
                wx.showToast({ title: '清除失败', icon: 'error' });
            }
            });
            wx.showLoading({ title: '清除中...', mask: true });

            // 监听设备的BLE特征值变化反馈
            wx.onBLECharacteristicValueChange((res) => {
            const value = String.fromCharCode.apply(null, new Uint8Array(res.value));
            // 设备端需对应返回 NICK_OK/NICK_FAIL 标识
            if (value === "CLEAR_OK") {
                wx.hideLoading();
                wx.showToast({ title: '清除成功' });
            } else if (value === "CLEAR_FAIL") {
                wx.hideLoading();
                wx.showModal({ title: '失败', content: '清除失败，请重试', showCancel: false });
            }
            });
            // 拆分serviceId和characteristicId（和硬件约定的UUID格式）
            const [serviceId, characteristicId] = fullUUID.split(',');
            if (!serviceId || !characteristicId) {
            wx.showToast({
                title: 'UUID格式错误',
                icon: 'none',
            });
            return;
            }
        }
    })
  },
})