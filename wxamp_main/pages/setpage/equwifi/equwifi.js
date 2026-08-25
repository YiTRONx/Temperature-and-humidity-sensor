// pages/setpage/equwifi/equwifi.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    ssid: '',
    pass: '',
    deviceId: '',
    fullUUID: '',
    equNAME: '',
    // serviceId:''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    console.log(options);
    const fullUUID = options.fullUUID;
    const deviceId = options.deviceId;
    const equName = decodeURIComponent(options.equNAME);
    this.setData({
        fullUUID: fullUUID,
        deviceId : deviceId,
        equNAME: equName,
      });
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

//   stringToBuffer(str) {
//     let buf = new ArrayBuffer(str.length);
//     let bufView = new Uint8Array(buf);
//     for (let i = 0; i < str.length; i++) {
//       bufView[i] = str.charCodeAt(i);
//     }
//     return buf;
//   },
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

  inputSSID(e) { this.setData({ ssid: e.detail.value }); },
  
  inputPass(e) { this.setData({ pass: e.detail.value }); },

  sendWiFiConfig() {
    const { ssid, pass, deviceId } = this.data;
    if (!ssid || !pass) {
      wx.showToast({ title: '请输入完整信息', icon: 'none' });
      return;
    }

    const msg = `WIFI:${ssid},${pass}`;
    const buffer = this.stringToBuffer(msg);

    wx.writeBLECharacteristicValue({
      deviceId,
      serviceId: "74685301-2022-2026-0114-6D2B8A3F9E1C",
      characteristicId: "BEB5483E-36E1-4688-B7F5-EA07361B26A8",
      value: buffer,
      success: () => {
        wx.showToast({ title: '配置已发送' });
        // 延迟返回，让用户看清提示
        setTimeout(() => { wx.navigateBack(); }, 1500);
      },
      fail: (err) => {
        console.error('发送失败', err);
        wx.showToast({ title: '发送失败', icon: 'error' });
      }
    });
  },
  
  connect() {
    const { ssid, pass, deviceId } = this.data;
    if (!ssid || !pass) return wx.showToast({title:'请输入完整', icon:'none'});
  
    wx.showLoading({ title: '设备联网中...', mask: true });
  
    // 监听设备反馈
    wx.onBLECharacteristicValueChange((res) => {
      const value = String.fromCharCode.apply(null, new Uint8Array(res.value));
      if (value === "WIFI_OK") {
        wx.hideLoading();
        wx.showToast({ title: '连接成功' });
        setTimeout(() => wx.navigateBack(), 1500);
      } else if (value === "WIFI_FAIL") {
        wx.hideLoading();
        wx.showModal({ title: '失败', content: 'WiFi连接超时，请检查密码', showCancel: false });
      }
    });
  
    const msg = `WIFI:${ssid},${pass}`;
    wx.writeBLECharacteristicValue({
      deviceId,
      serviceId: "74685301-2022-2026-0114-6D2B8A3F9E1C",
      characteristicId: "BEB5483E-36E1-4688-B7F5-EA07361B26A8",
      value: this.stringToBuffer(msg)
    });
  }
})