// app.js
App({
  onLaunch() {
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 登录
    wx.login({
      success: res => {
        // 发送 res.code 到后台换取 openId, sessionKey, unionId
      }
    })
  },
  globalData: {
    IsLogin:false,
    Websocket_Port : 10173,
    Http_URL : "https://22f2c92f.r31.cpolar.top/",
    SaveSelectedList: [], // 已添加设备列表
    Appequlist:[ //设备添加列表
        {
            equID:"3A7F2-8D1E49",
            equICON:"/icons/wenshidu-2.png",
            equNAME:"温湿度传感器V0",
            nickNAME:"",
            equTEMP:"25.2",
            equHUM:"37",
            selected:"false",
            IsOnline:false
        },
        {
            equID:"9B2C5-6E0A3",
            equICON:"/icons/wenshidu-2.png",
            equNAME:"温湿度传感器V0",
            nickNAME:"",
            equTEMP:"24.7",
            equHUM:"32",
            selected:"false",
            IsOnline:true
        }
    ],
    globalDeviceConfig: {},
    Appequsetting:{
        equID:null,
        equNickName:null,
        equAdd:null,
        equWifiSSID:null,
        equWifiPWD:null,
        equTempUp:null,
        equTempLo:null,
        equHumUp:null,
        equHumLo:null,
        equRefresh:null,
        equScreenDW:null,
    },
    AppUserSetting:{
        avatarUrl: null,
        nickName:null,
        userUniqueId: null, // 用户唯一标识
        userNotice:null,
    }
  },
  updateSharedList(newList) {
    this.globalData.AppselectedDevices = newList;
  },
  "networkTimeout": {
    "request": 10000,
    "connectSocket": 10000
  },
  "permission": {
    "scope.userLocation": {
      "desc": "用于蓝牙设备搜索"
    }
  }
})
