// pages/setpage/setpage.js
const app = getApp();
Page({

  /**
   * 页面的初始数据
   */
  data: {
    fullUUID:" ",
    deviceId :" ",
    equID: " ",
    equNAME: " ",
    serviceId: "74685301-2022-2026-0114-6D2B8A3F9E1C", // 你的蓝牙服务ID
    characteristicId: "BEB5483E-36E1-4688-B7F5-EA07361B26A8", // 特征值ID 
    hasGetConfig: false, // 标记是否已发送过 GET_CONFIG 指令
    deviceConfig: {},
    selectedDevices:{},
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    console.log(options);
    const fullUUID = options.fullUUID;
    const deviceId = options.deviceId;
    const equName = decodeURIComponent(options.equNAME);
    const header = fullUUID.substring(0, 8);
    const footer = fullUUID.substring(24);
    this.setData({
      fullUUID: fullUUID,
      deviceId : deviceId,
      equNAME: equName,
      equID: `${header}-${footer}`,
    });
    this.sendGetConfigCmd();
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
    this.sendGetConfigCmd();
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
    app.globalData.globalDeviceConfig = {};
    wx.offBLECharacteristicValueChange(onConfigReply);
    console.log('退出设置页面，已清除全局配置缓存');
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
  /**
   * 发送 GET_CONFIG 指令到蓝牙设备
   */
  sendGetConfigCmd() {
    const { deviceId, serviceId, characteristicId } = this.data;
    if (!deviceId) {
      wx.showToast({ title: '未连接蓝牙设备', icon: 'none' });
      return;
    }

    // 字符串转ArrayBuffer（复用你原有WiFi配置的转换方法）
    const stringToBuffer = (str) => {
      let buf = new ArrayBuffer(str.length);
      let bufView = new Uint8Array(buf);
      for (let i = 0; i < str.length; i++) {
        bufView[i] = str.charCodeAt(i);
      }
      return buf;
    };

    // 发送 GET_CONFIG 指令
    wx.writeBLECharacteristicValue({
      deviceId,
      serviceId,
      characteristicId,
      value: stringToBuffer('GET_CONFIG'),
      success: () => {
        console.log('GET_CONFIG 指令发送成功，等待设备返回配置');
      },
      fail: (err) => {
        console.error('GET_CONFIG 指令发送失败', err);
        wx.showToast({ title: '获取配置失败', icon: 'error' });
      }
    });

    // 监听设备返回的配置数据
    this.listenConfigReply();
  },

listenConfigReply() {
    const onConfigReply = (res) => {
      try {
        const configStr = decodeURIComponent(escape(String.fromCharCode.apply(null, new Uint8Array(res.value))));
        console.log('设备返回配置字符串：', configStr);
  
        const configObj = {};
        const configItems = configStr.split('|');
        configItems.forEach(item => {
          if (!item) return;
          const [key, value] = item.split(':');
          switch (key) {
            case 'TEMP':
              const [tempLow, tempHigh] = value.split(',');
              configObj.temp = { low: parseInt(tempLow), high: parseInt(tempHigh) };
              break;
            case 'HUM':
              const [humLow, humHigh] = value.split(',');
              configObj.hum = { low: parseInt(humLow), high: parseInt(humHigh) };
              break;
            case 'NICK':
              configObj.nickname = value; // 正确赋值nickname
              break;
            case 'LOC':
              configObj.location = value;
              break;
            case 'MQTT':
              const [mqttServer, mqttPort] = value.split(',');
              configObj.mqtt = { server: mqttServer, port: parseInt(mqttPort) };
              break;
            case 'REFRESH':
              configObj.refreshInterval = parseInt(value);
              break;
            case 'SCREEN':
              configObj.screenOffTime = parseInt(value);
              break;
          }

        });
  
        // 存入全局变量
        app.globalDeviceConfig = configObj;
        console.log('配置解析完成，全局存储：', app.globalDeviceConfig);
  
        this.setData({ deviceConfig: app.globalDeviceConfig });
        console.log('触发页面刷新（已拿到配置）');
  
        wx.offBLECharacteristicValueChange(onConfigReply);
        console.log('配置解析完成关闭监听');

        // const deviceId = this.data.deviceId;
        // const updatedList = this.data.selectedDevices.map(item => {
        //     if (item.deviceId === deviceId) {
        //       return { ...item, equNickName : configObj.nickname };
        //     }
        //     return item;
        //   });
        //   this.setData({ selectedDevices: updatedList });
        //   app.globalData.SaveSelectedList = updatedList;
        //   wx.setStorageSync("SaveSelectedList", JSON.stringify(updatedList));

      } catch (e) {
        console.error('配置解析失败', e);
        wx.showToast({ title: '配置解析异常', icon: 'none' });
        wx.offBLECharacteristicValueChange(onConfigReply);
        console.log('配置解析失败关闭监听');
      }
    };
  
    // 先移除旧监听（现在onConfigReply已定义，顺序正确）
    wx.offBLECharacteristicValueChange(onConfigReply);
    // 绑定监听
    wx.onBLECharacteristicValueChange(onConfigReply);
  },

    // // 解绑设备事件
    // unbind(e) {
    //     const deviceId = this.data.deviceId;
    //     const LoadSyncList = wx.getStorageSync("SaveSelectedList");
    //     const oldList = app.globalData.SaveSelectedList;
    //     console.log('oldlist',LoadSyncList)
    //     // 显示确认对话框
    //     wx.showModal({
    //       title: '确认解绑',
    //       content: '确定要解绑该设备吗？',
    //       success: (res) => {
    //         if (res.confirm) {
    //             // 1. 【新增逻辑】断开蓝牙物理连接
    //             wx.closeBLEConnection({
    //                 deviceId: deviceId,
    //                 success: (res) => {
    //                     console.log("解绑并断开蓝牙成功:", deviceId);
    //                 },
    //                 fail: (err) => {
    //                     console.log("设备可能本就处于断开状态或断开失败:", err);
    //                 }
    //             });
    //           // 从列表中移除该设备
    //           const newList = LoadSyncList.filter(device => device.deviceId !== deviceId);
    //           console.log('newlist',newList)
    //           // 更新数据
    //         wx.setStorageSync("SaveSelectedList", JSON.stringify(newList));
    //         wx.setStorageSync("SaveSelectedList", JSON.stringify(newList));

    //           // 如果设备列表是全局共享的，也需要更新全局数据
    //         app.globalData.SaveSelectedList = newList;
    
    //           // 显示操作成功提示
    //           wx.showToast({
    //             icon:'success',
    //             title: '解绑成功'
    //           });
    
    //           // 返回设备页面
    //         //   wx.navigateBack({
    //         //     delta: 2
    //         //   });
    //             wx.reLaunch({
    //             url: '/pages/equipment/equipemnt',
    //             });
    //             }
    //       }
    //     });
    //   },
// 解绑设备事件
unbind(e) {
    const deviceId = this.data.deviceId;
    const LoadSyncList = wx.getStorageSync("SaveSelectedList");
    const oldList = app.globalData.SaveSelectedList;
    console.log('oldlist',LoadSyncList)
    
    // 【修复1：deviceId空值校验】
    if (!deviceId) {
        wx.showToast({ icon: 'error', title: '设备ID为空，解绑失败' });
        return;
    }

    // 显示确认对话框
    wx.showModal({
      title: '确认解绑',
      content: '确定要解绑该设备吗？',
      success: (res) => {
        if (res.confirm) {
            // 1. 【新增逻辑】断开蓝牙物理连接
            wx.offBLEConnectionStateChange();
            wx.offBLECharacteristicValueChange();
            wx.offBluetoothAdapterStateChange();
            wx.closeBLEConnection({
                deviceId: deviceId,
                success: (res) => {
                    console.log("解绑并断开蓝牙成功:", deviceId);
                },
                fail: (err) => {
                    console.log("设备可能本就处于断开状态或断开失败:", err);
                },
                // 【修复2：异步时序问题】蓝牙操作完成后再处理列表（无论成败）
                complete: () => {
                    // 【修复3：处理本地存储读取解析 + 空值】
                    let parseList = [];
                    if (LoadSyncList) {
                        // 解析存储的JSON字符串为数组（原存储时用了JSON.stringify）
                        parseList = typeof LoadSyncList === 'string' ? JSON.parse(LoadSyncList) : LoadSyncList;
                    }
                    // 从列表中移除该设备（基于解析后的数组）
                    const newList = parseList.filter(device => device?.deviceId !== deviceId);
                    console.log('newlist',newList)
                    
                    // 【修复4：移除重复的存储操作】
                    wx.setStorageSync("SaveSelectedList", JSON.stringify(newList));

                    // 如果设备列表是全局共享的，也需要更新全局数据
                    app.globalData.SaveSelectedList = newList;

                    // 断开MQTT（WebSocket）连接
                    if (this.data.wsTask) {
                        this.data.wsTask.close({ code: 1000, reason: '执行unbind操作，主动断开MQTT连接' });
                    }
                    // 重置MQTT相关状态
                    this.setData({
                        wsConnected: false,
                        wsTask: null,
                        reconnectCount: 0, // 重置重连次数
                        lastMqttData: {} // 清空缓存的MQTT数据
                    });
            
                    // 显示操作成功提示
                    wx.showToast({
                      icon:'success',
                      title: '解绑成功'
                    });
            
                    wx.reLaunch({
                        url: '/pages/equipment/equipemnt',
                    });
                }
            });
          }
      }
    });
  },
    // /**
    // * 点击设置按键项跳转到Wi-Fi设置页
    // * @param {Object} event 事件对象
    // */
      equnickname(event){
        console.log(event);
        const fullUUIDto = event.currentTarget.dataset.fulluuid;
        const deviceIdto = event.currentTarget.dataset.deviceid;
        const NickNameto = event.currentTarget.dataset.nickname;
        wx.navigateTo({
          url: '/pages/setpage/equnickname/equnickname?fullUUID='+fullUUIDto+'&deviceId='+deviceIdto+'&NickName='+NickNameto,
        });
      },

      equadd(event){
        console.log(event);
        const fullUUIDto = event.currentTarget.dataset.fulluuid;
        const deviceIdto = event.currentTarget.dataset.deviceid;
        const Locationto = event.currentTarget.dataset.location;
        wx.navigateTo({
          url: '/pages/setpage/equadd/equadd?fullUUID='+fullUUIDto+'&deviceId='+deviceIdto+'&Location='+Locationto,
        });
        wx.navigateTo({
            url: '/pages/setpage/equadd/equadd',
          });
      },


   /**
   * @param {Object} event 事件对象
   */
      equwifi: function(event) {
        console.log(event);
        const fullUUIDto = event.currentTarget.dataset.fulluuid;
        const deviceIdto = event.currentTarget.dataset.deviceid;
        const equNAMEto = event.currentTarget.dataset.equname;
        wx.navigateTo({
          url: '/pages/setpage/equwifi/equwifi?fullUUID='+fullUUIDto+'&deviceId='+deviceIdto+'&equNAME='+equNAMEto,
        });
      },

      equalarm(event){
        console.log(event);
        const fullUUIDto = event.currentTarget.dataset.fulluuid;
        const deviceIdto = event.currentTarget.dataset.deviceid;
        const TempMin = event.currentTarget.dataset.tempmin;
        const TempMax = event.currentTarget.dataset.tempmax;
        const HumMin = event.currentTarget.dataset.hummin;
        const HumMax = event.currentTarget.dataset.hummax;
        wx.navigateTo({
            url: '/pages/setpage/equalarm/equalarm?fullUUID='+fullUUIDto+'&deviceId='+deviceIdto+'&TempMin='+TempMin+'&TempMax='+TempMax+'&HumMin='+HumMin+'&HumMax='+HumMax,
          });
      },

        /**
   * 点击设置按键项跳转到详情页
   * @param {Object} event 事件对象
   */
      equdetailed:function(event){
        console.log(event);
        const equIDto = event.currentTarget.dataset.equid;
        const equNAMEto = event.currentTarget.dataset.equname;
        wx.navigateTo({
          url: '/pages/setpage/equdetailed/equdetailed?equID='+equIDto+'&equNAME='+equNAMEto,
        });
      },

      equOTA(e){
        wx.showToast({
            icon:'error',
            title: '功能未实现'
          });
      },

      otherset(event){
        const fullUUIDto = event.currentTarget.dataset.fulluuid;
        const deviceIdto = event.currentTarget.dataset.deviceid;
        const RefreshTime = event.currentTarget.dataset.refresh;
        const ScreenTime = event.currentTarget.dataset.screen;
        wx.navigateTo({
            url: '/pages/setpage/otherset/otherset?fullUUID='+fullUUIDto+'&deviceId='+deviceIdto+'&RefreshTime='+RefreshTime+'&ScreenTime='+ScreenTime,
          });
      },
})