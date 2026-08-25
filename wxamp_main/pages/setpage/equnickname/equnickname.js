// pages/setpage/equnickname/equnickname.js
Page({

    /**
     * 页面的初始数据
     */
    data: {
      nickname: '', // 输入的新设备昵称
      deviceId: '',
      fullUUID: '',
    },
  
    /**
     * 生命周期函数--监听页面加载
     */
    onLoad(options) {
      console.log(options);
      const fullUUID = options.fullUUID;
      const deviceId = options.deviceId;
      const NickName = options.NickName;
      this.setData({
        fullUUID: fullUUID,
        deviceId: deviceId,
        nickname: NickName, // 初始显示原始设备名称
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
  
    /**
     * 监听设备昵称输入
     */
    inputNickname(e) {
      this.setData({
        nickname: e.detail.value
      });
    },
  
    /**
     * 保存昵称（发送配置到蓝牙设备）
     */
    connect() {
      const { nickname, deviceId } = this.data;
      // 验证昵称是否为空
      if (!nickname) {
        return wx.showToast({ title: '请输入设备昵称', icon: 'none' });
      }

      // 构造昵称配置指令（格式参考WiFi的指令逻辑）
      const msg = `NICK:${nickname}`;
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
          console.error('昵称配置发送失败', err);
          wx.showToast({ title: '发送失败', icon: 'error' });
        }
      });
      wx.showLoading({ title: '保存昵称中...', mask: true });
  
      // 监听设备的BLE特征值变化反馈
      wx.onBLECharacteristicValueChange((res) => {
        const value = String.fromCharCode.apply(null, new Uint8Array(res.value));
        // 设备端需对应返回 NICK_OK/NICK_FAIL 标识
        if (value === "NICK_OK") {
          wx.hideLoading();
          wx.showToast({ title: '昵称保存成功' });
          // 延迟返回上一页，保证用户能看到提示
          setTimeout(() => wx.navigateBack(), 1500);
        } else if (value === "NICK_FAIL") {
          wx.hideLoading();
          wx.showModal({ title: '失败', content: '昵称保存失败，请重试', showCancel: false });
        }
      });
  
      
    },
  
    /**
     * 用户点击右上角分享
     */
    onShareAppMessage() {
  
    }
  })