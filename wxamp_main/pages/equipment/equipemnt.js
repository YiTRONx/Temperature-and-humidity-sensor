const app = getApp();

Page({
  data: {
    isModalShow: false,
    uuidHeader: "74685301",
    uuidCenter: "2022-2026-0114",
    serviceId: "",
    selectedDevices: [],
    equlist: [],
    characteristicId: "BEB5483E-36E1-4688-B7F5-EA07361B26A8",
    // ===== 替换MQTT配置为小程序原生WS配置 =====
    wsConnected: false, // 原生WS连接状态
    wsTask: null, // 小程序WS任务实例
    wsConfig: {
      url: 'ws://31.tcp.cpolar.top:10325/mqtt', // 必须带/mqtt路径
      clientId: 'wxapp_' + Math.random().toString(16).substr(2, 8),
      username: '', // 无则留空
      password: '', // 无则留空
      topic: 'home/sensor/th' // 订阅的主题
    },
    lastMqttData: {},
    mqttDataExpire: 10 * 1000,
    reconnectCount: 0, // 重连次数
    maxReconnect: 10, // 最大重连次数
    reconnectDelay: 5000 // 初始延迟
  },

  onLoad() {
    const LoadSyncList = wx.getStorageSync("SaveSelectedList");
    console.log("读取本地列表：", LoadSyncList);
    if (LoadSyncList) {
      const selectedDevices = JSON.parse(LoadSyncList);
      this.setData({ selectedDevices });
      app.globalData.SaveSelectedList = LoadSyncList;
      // 初始化原生WS（替代原initMQTT）
      this.initWxWebSocket(() => {
        selectedDevices.forEach(device => {
          this.checkMQTTData(device);
        });
      });
    }
    // 先清理旧监听，避免重复绑定
    wx.offBLEConnectionStateChange();
    // 全局绑定一次连接状态监听
    wx.onBLEConnectionStateChange((res) => {
        console.log(`设备 ${res.deviceId} 状态: ${res.connected ? '已连接' : '已断开'}`);
        if (!res.connected) {
        const device = this.data.selectedDevices.find(d => d.deviceId === res.deviceId);
        if (device) {
            this.checkMQTTData(device); // 有MQTT数据则用，无则重连蓝牙
        } else {
            console.warn(`设备${res.deviceId}不在列表，无需重连`);
            return;
            }
        }
    });
  },

  onShow() {
    const stored = wx.getStorageSync("SaveSelectedList");
    if (stored) {
      const list = JSON.parse(stored);
      this.setData({ selectedDevices: list });
      this.initWxWebSocket(() => {
        list.forEach(device => {
          this.checkMQTTData(device);
        });
      });
    }
  },

  // ===== 核心：小程序原生WS实现MQTT连接 =====
  initWxWebSocket(callback) {
    // 避免重复连接
    if (this.data.wsConnected) {
      callback && callback();
      return;
    }

    const { url, clientId, username, password } = this.data.wsConfig;
    // 1. 关闭已有WS连接（防止残留）
    if (this.data.wsTask) {
      this.data.wsTask.close({ code: 1000, reason: '重新连接' });
    }

    // 2. 构建MQTT连接的CONN帧（MQTT 3.1.1协议核心）
    const connectPacket = this.buildMQTTConnectPacket(clientId, username, password);

    // 3. 小程序原生WS连接
    const wsTask = wx.connectSocket({
      url: url, // ws://IP:8083/mqtt
      header: {
        'Content-Type': 'application/octet-stream'
      },
      protocols: ['mqtt'], // 指定MQTT子协议
      success: () => {
        console.log('WS连接请求发送成功');
      },
      fail: (err) => {
        console.error('WS连接失败：', err);
        this.setData({ wsConnected: false });
        callback && callback(); // 失败仍执行蓝牙逻辑
        this.isMQTTconnetFail();
      }
    });
    this.setData({ wsTask: wsTask });

    // 4. WS连接成功回调
    wx.onSocketOpen((res) => {
      console.log('WS连接已打开');
      this.setData({ wsConnected: true });
      // 发送MQTT CONNECT帧（完成MQTT连接）
      wsTask.send({
        data: connectPacket,
        success: () => {
          console.log('MQTT CONNECT帧发送成功');
          // 订阅主题
          this.subscribeMQTTTopic(this.data.wsConfig.topic);
        },
        fail: (err) => {
          console.error('发送CONNECT帧失败：', err);
          this.isMQTTconnetFail();
        }
      });
      callback && callback();
    });

    // 5. 接收WS消息（MQTT数据）
    wx.onSocketMessage((res) => {
      this.handleMQTTMessage(res.data);
    });

    // 6. WS连接关闭
    wx.onSocketClose((res) => {
      console.log('WS连接已关闭：', res);
      this.setData({ wsConnected: false, wsTask: null });
      this.isMQTTconnetFail();
      // 自动重连（可选）
      setTimeout(() => {
        this.initWxWebSocket(callback);
      }, 5000);
    });

    // 7. WS错误回调
    wx.onSocketError((err) => {
      console.error('WS连接错误：', err);
      this.setData({ wsConnected: false });
      this.isMQTTconnetFail();
    });

    // 修改WS关闭后的重连逻辑
    wx.onSocketClose((res) => {
        console.log('WS连接关闭：', res);
        this.setData({ wsConnected: false, wsTask: null });
        this.isMQTTconnetFail();
        // 带退避策略的重连（5s→10s→15s...，最多10次）
        if (this.data.reconnectCount < this.data.maxReconnect) {
        const delay = this.data.reconnectDelay * (this.data.reconnectCount + 1);
        setTimeout(() => {
            this.setData({ reconnectCount: this.data.reconnectCount + 1 });
            this.initWxWebSocket(callback);
        }, delay);
        } else {
        console.log('已达最大重连次数，停止重连');
        this.setData({ reconnectCount: 0 }); // 重置次数
        }
    });
  },

  

  // ===== MQTT协议：构建CONNECT帧（核心协议解析）=====
  buildMQTTConnectPacket(clientId, username, password) {
    const buffer = [];
    // 固定头：MQTT CONNECT类型（1） + 剩余长度（后续计算）
    buffer.push(0x10);

    // 可变头：协议名(MQTT) + 协议版本(4) + 连接标志 + 心跳(60)
    const protocolName = 'MQTT';
    buffer.push(protocolName.length >> 8, protocolName.length & 0xFF);
    for (let i = 0; i < protocolName.length; i++) {
      buffer.push(protocolName.charCodeAt(i));
    }
    buffer.push(0x04); // 协议版本3.1.1

    // 连接标志：清理会话(0x02) + 用户名/密码标志（有则加）
    let connectFlags = 0x02; // clean session
    let payloadLength = clientId.length + 2; // clientId的长度(2字节) + 内容

    if (username && username.length > 0) {
      connectFlags |= 0x80; // 用户名标志
      payloadLength += username.length + 2;
      if (password && password.length > 0) {
        connectFlags |= 0x40; // 密码标志
        payloadLength += password.length + 2;
      }
    }
    buffer.push(connectFlags);
    buffer.push(0x00, 0x3C); // 心跳间隔60秒

    // 有效载荷：ClientId + 用户名 + 密码
    // ClientId
    buffer.push(clientId.length >> 8, clientId.length & 0xFF);
    for (let i = 0; i < clientId.length; i++) {
      buffer.push(clientId.charCodeAt(i));
    }
    // 用户名
    if (username && username.length > 0) {
      buffer.push(username.length >> 8, username.length & 0xFF);
      for (let i = 0; i < username.length; i++) {
        buffer.push(username.charCodeAt(i));
      }
      // 密码
      if (password && password.length > 0) {
        buffer.push(password.length >> 8, password.length & 0xFF);
        for (let i = 0; i < password.length; i++) {
          buffer.push(password.charCodeAt(i));
        }
      }
    }

    // 计算剩余长度并插入固定头后
    const remainingLength = buffer.length - 1;
    let len = remainingLength;
    let pos = 1;
    do {
      let byte = len % 128;
      len = Math.floor(len / 128);
      if (len > 0) byte |= 0x80;
      buffer.splice(pos, 0, byte);
      pos++;
    } while (len > 0);

    // 转为ArrayBuffer（小程序WS支持的格式）
    const ab = new ArrayBuffer(buffer.length);
    const view = new Uint8Array(ab);
    for (let i = 0; i < buffer.length; i++) {
      view[i] = buffer[i];
    }
    return ab;
  },

  // ===== MQTT协议：订阅主题 =====
  subscribeMQTTTopic(topic) {
    if (!this.data.wsConnected || !this.data.wsTask) return;

    // 构建SUBSCRIBE帧（订阅类型10，QoS 0）
    const packetId = 1; // 包ID（固定1即可）
    const buffer = [];

    // 固定头
    buffer.push(0x82); // SUBSCRIBE类型(10) + 标志(0x02)

    // 可变头 + 有效载荷
    const variableHeader = [packetId >> 8, packetId & 0xFF];
    const payload = [topic.length >> 8, topic.length & 0xFF];
    for (let i = 0; i < topic.length; i++) {
      payload.push(topic.charCodeAt(i));
    }
    payload.push(0x00); // QoS 0

    // 剩余长度
    const remainingLength = variableHeader.length + payload.length;
    buffer.push(remainingLength);
    buffer.push(...variableHeader, ...payload);

    // 发送订阅帧
    const ab = new ArrayBuffer(buffer.length);
    const view = new Uint8Array(ab);
    for (let i = 0; i < buffer.length; i++) {
      view[i] = buffer[i];
    }

    this.data.wsTask.send({
      data: ab,
      success: () => {
        console.log(`订阅主题 ${topic} 成功`);
      },
      fail: (err) => {
        console.error('订阅主题失败：', err);
      }
    });
  },

  // ===== 处理MQTT消息（解析PUBLISH帧）=====
  handleMQTTMessage(data) {
    try {
      // 转为Uint8Array解析
      const view = new Uint8Array(data);
      // 过滤非PUBLISH帧（只处理消息发布帧）
      if ((view[0] & 0xF0) !== 0x30) return;

      // 解析剩余长度
      let len = 0, pos = 1;
      let byte;
      do {
        byte = view[pos++];
        len += (byte & 0x7F) << (7 * (pos - 2));
      } while ((byte & 0x80) !== 0);

      // 解析主题长度和内容
      const topicLen = (view[pos] << 8) | view[pos + 1];
      pos += 2;
      let topic = '';
      for (let i = 0; i < topicLen; i++) {
        topic += String.fromCharCode(view[pos++]);
      }

      // 解析消息体（JSON数据）
      let payload = '';
      for (let i = pos; i < view.length; i++) {
        payload += String.fromCharCode(view[i]);
      }

      if (topic === this.data.wsConfig.topic) {
        const mqttData = JSON.parse(payload);
        console.log('解析MQTT数据：', mqttData);
        // 缓存数据
        this.data.lastMqttData[mqttData.UUID] = {
          temp: mqttData.temp,
          humi: mqttData.humi,
          time: new Date(mqttData.time).getTime(),
          uuid: mqttData.UUID
        };
        // 更新页面
        this.updateDeviceByMQTT(mqttData.UUID, mqttData.temp, mqttData.humi);
      }
    } catch (e) {
      console.error('解析MQTT消息失败：', e);
    }
  },

  // ===== 检查MQTT数据（逻辑不变）=====
  checkMQTTData(device) {
    const { lastMqttData, mqttDataExpire } = this.data;
    const deviceUUID = device.fullUUID;
    const mqttData = lastMqttData[deviceUUID];

    if (mqttData && (Date.now() - mqttData.time) < mqttDataExpire) {
      console.log(`设备 ${deviceUUID} 使用MQTT数据`);
      this.updateDeviceByMQTT(deviceUUID, mqttData.temp, mqttData.humi);
    } else {
      console.log(`设备 ${deviceUUID} 无最新MQTT数据，尝试蓝牙连接`);
      this.reconnectDevice(device.deviceId, device.fullUUID);
    }
  },

  // ===== 更新设备数据（逻辑不变）=====
  updateDeviceByMQTT(uuid, temp, humi) {
    const updatedList = this.data.selectedDevices.map(item => {
      if (item.fullUUID === uuid) {
        return { ...item, equTEMP: temp, equHUM: humi, IsOnline: true };
      }
      return item;
    });
    this.setData({ selectedDevices: updatedList });
    app.globalData.SaveSelectedList = updatedList;
    wx.setStorageSync("SaveSelectedList", JSON.stringify(updatedList));
  },

  isMQTTconnetFail(){
    // 2. 检查列表中的每个设备，如果离线则尝试静默重连
    console.log('MQTT连接失败，自动开始蓝牙连接')
    this.data.selectedDevices.forEach(device => {
    this.reconnectDevice(device.deviceId,device.fullUUID);
    this.listenConnectionState(device.deviceId);
    });
  },

  // ===== 以下原有函数全部保留（无修改）=====
  reconnectDevice(deviceId, fullUUID) {
    wx.openBluetoothAdapter({
      success: () => {
        wx.createBLEConnection({
          deviceId: deviceId,
          success: () => {
            console.log("设备自动重连成功:", deviceId);
            setTimeout(() => {
              this.initBLEService(deviceId, fullUUID);
            }, 1000);
          },
          fail: (err) => {
            console.warn("蓝牙连接失败：", err);
            this.setDeviceOffline(deviceId);
          }
        });
      },
      fail: (err) => {
        console.warn("蓝牙适配器打开失败：", err);
        this.setDeviceOffline(deviceId);
      }
    });
  },

  setDeviceOffline(deviceId) {
    const updatedList = this.data.selectedDevices.map(item => {
      if (item.deviceId === deviceId) {
        return { ...item, IsOnline: false };
      }
      return item;
    });
    this.setData({ selectedDevices: updatedList });
    app.globalData.SaveSelectedList = updatedList;
    wx.setStorageSync("SaveSelectedList", JSON.stringify(updatedList));
  },

  showequ() {
    this.setData({ isModalShow: true, equlist: [] });
    wx.openBluetoothAdapter({
      success: (res) => {
        this.startSearch();
      },
      fail: (err) => {
        wx.showToast({ title: '请开启手机蓝牙', icon: 'none' });
      }
    });
  },

  startSearch() {
    this.setData({ equlist: [] });
    wx.openBluetoothAdapter({
      success: () => {
        wx.startBluetoothDevicesDiscovery({
          success: () => {
            wx.onBluetoothDeviceFound((res) => {
              res.devices.forEach(device => {
                if (device.advertisServiceUUIDs) {
                  device.advertisServiceUUIDs.forEach(uuid => {
                    const upperUUID = uuid.toUpperCase();
                    const header = upperUUID.substring(0, 8);
                    const center = upperUUID.substring(9, 23);
                    const footer = upperUUID.substring(24);
                    if (header === this.data.uuidHeader && center === this.data.uuidCenter) {
                      const isExist = this.data.equlist.some(d => d.fullUUID === upperUUID);
                      if (!isExist) {
                        let modelName = "未知设备";
                        if (header === "74685301") modelName = "温湿度传感器V2";
                        // else if (header === "74685302") modelName = "温湿度传感器V2";
                        const newDevice = {
                          deviceId: device.deviceId,
                          fullUUID: upperUUID,
                          equID: `${header}-${footer}`,
                          equNAME: modelName,
                          equTEMP: '--',
                          equHUM: '--',
                          IsOnline: false,
                          selected: false,
                          equICON: "/icons/device.png",
                          equNickName :""
                        };
                        this.setData({
                          equlist: [...this.data.equlist, newDevice]
                        });
                      }
                    }
                  });
                }
              });
            });
          }
        });
      }
    });
  },

  selectDevice(e) {
    const device = e.currentTarget.dataset.device;
    const list = this.data.equlist.map(item => ({
      ...item,
      selected: item.fullUUID === device.fullUUID
    }));
    this.setData({ equlist: list });
  },

  confirmSelect() {
    const target = this.data.equlist.find(d => d.selected);
    if (!target) {
      wx.showToast({ title: '请先选择一个设备', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '正在连接...', duration: 500 });
    wx.createBLEConnection({
      deviceId: target.deviceId,
      success: (res) => {
        wx.stopBluetoothDevicesDiscovery();
        target.IsOnline = true;
        if (target) {
          const isDuplicate = this.data.selectedDevices.some(
            device => device.fullUUID === target.fullUUID
          );
          if (!isDuplicate) {
            const newSelectedDevices = [...this.data.selectedDevices, target];
            this.setData({
              selectedDevices: newSelectedDevices,
              isModalShow: false
            });
            wx.setStorageSync("SaveSelectedList", JSON.stringify(newSelectedDevices));
            app.globalData.SaveSelectedList = this.data.selectedDevices;
            this.listenConnectionState(target.deviceId);
            setTimeout(() => {
              this.initBLEService(target.deviceId, target.fullUUID);
            }, 1000);
            this.CLEARCLEARCLEAR(target.deviceId, target.fullUUID);
            wx.hideLoading();
            wx.showToast({
              title: '设备添加成功',
              icon: 'success',
              duration: 1500
            });
          } else {
            wx.showToast({
              title: '该设备已添加',
              icon: 'none',
              duration: 1500
            });
            this.setData({ isModalShow: false });
          };
        };
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({ title: '连接失败', icon: 'none' });
        console.error("连接失败原因：", err);
      }
    });
  },

  listenConnectionState(deviceId) {
    wx.onBLEConnectionStateChange((res) => {
      console.log(`设备 ${res.deviceId} 状态变化: ${res.connected ? '已连接' : '已断开'}`);
      if (!res.connected) {
        const device = this.data.selectedDevices.find(d => d.deviceId === res.deviceId);
        if (device) {
          this.checkMQTTData(device);
        } else {
          this.reconnectDevice(res.deviceId, device.fullUUID);
          this.setDeviceOffline(res.deviceId);
        }
      }
    });
  },


initBLEService(deviceId, fullUUID) {
    wx.getBLEDeviceServices({
      deviceId,
      success: (res) => {
        // 找到传感器对应的蓝牙服务ID（需匹配硬件实际的服务UUID）
        const targetService = res.services.find(service => 
          service.uuid.toUpperCase().startsWith(this.data.uuidHeader)
        );
        if (!targetService) {
          wx.showToast({ title: '未找到传感器服务', icon: 'none' });
          this.setDeviceOffline(deviceId);
          return;
        }
        // 用正确的服务ID获取特征值
        wx.getBLEDeviceCharacteristics({
          deviceId,
          serviceId: targetService.uuid,
          success: (res) => {
            this.startNotify(deviceId, targetService.uuid);
          },
          fail: (err) => {
            console.error('获取特征值失败：', err);
            this.setDeviceOffline(deviceId);
          }
        });
      },
      fail: (err) => {
        console.error('获取蓝牙服务失败：', err);
        this.setDeviceOffline(deviceId);
      }
    });
  },
  startNotify(deviceId, serviceId) {
    wx.notifyBLECharacteristicValueChange({
      deviceId,
      serviceId: serviceId,
      characteristicId: this.data.characteristicId,
      state: true,
      success: () => {
        console.log('Notify 开启成功');
        wx.hideLoading();
        this.setData({ isModalShow: false });
        wx.onBLECharacteristicValueChange((res) => {
          const arrayBuffer = res.value;
          const dataView = new Uint8Array(arrayBuffer);
          let dataStr = "";
          for (let i = 0; i < dataView.length; i++) {
            dataStr += String.fromCharCode(dataView[i]);
          }
          console.log('收到蓝牙原始数据:', dataStr);
          if (dataStr.includes(',')) {
            const [temp, hum] = dataStr.split(',');
            const updatedList = this.data.selectedDevices.map(item => {
              if (item.deviceId === deviceId) {
                return { ...item, equTEMP: temp, equHUM: hum, IsOnline: true };
              }
              return item;
            });
            this.setData({ selectedDevices: updatedList });
            app.globalData.SaveSelectedList = updatedList;
          }
        });
      },
      fail: (err) => {
        console.error('Notify 开启失败', err);
      }
    });
  },

  hideDeviceModal() {
    this.setData({ isModalShow: false });
    wx.stopBluetoothDevicesDiscovery();
  },

  startAutoUpdate: function () {
    setInterval(() => {
      this.data.selectedDevices.forEach(device => {
        this.listenConnectionState(device.deviceId);
      });
    }, 1000);
  },

  opendetailed: function (event) {
    console.log(event);
    const fullUUIDto = event.currentTarget.dataset.fulluuid;
    const deviceIdto = event.currentTarget.dataset.deviceid;
    const equNAMEto = event.currentTarget.dataset.equname;
    wx.navigateTo({
      url: '/pages/detailed/detailed?fullUUID=' + fullUUIDto + '&deviceId=' + deviceIdto + '&equNAME=' + equNAMEto,
    });
  },

  // 页面卸载关闭WS连接
  onUnload() {
    if (this.data.wsTask) {
      this.data.wsTask.close({ code: 1000, reason: '页面卸载' });
      this.setData({ wsTask: null, wsConnected: false });
    }
    // 清理蓝牙监听
    wx.offBluetoothDeviceFound();
    wx.offBLEConnectionStateChange();
    wx.offBLECharacteristicValueChange();
    // 停止蓝牙扫描
    wx.stopBluetoothDevicesDiscovery();
  },

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

  CLEARCLEARCLEAR(deviceId, fullUUID){
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
      }
    });
  },
});