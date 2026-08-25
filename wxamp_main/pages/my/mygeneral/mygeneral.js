const app = getApp();
Page({

    data: {
        Http_URL:"https://3bbf0a5c.r31.cpolar.top/getopenid",
    },
    // onLoad(options) {
    //     this.setData({
    //         Http_URL:app.globalDate.Http_URL,
    //     })
    // },
    // 点击按钮 发起订阅授权
    subscribeMsg() {
      // 替换成你自己的订阅消息模板ID
      const tmplIds = ["80u8sN2gVRBDiM5GApOmYZjYiKAKGWme7YddLpz26CY"];
  
      wx.requestSubscribeMessage({
        tmplIds: tmplIds,
        // 用户操作完成回调
        success: (res) => {
          console.log("订阅授权结果：", res);
  
          // 遍历模板，判断授权状态
          for (let key in res) {
            // accept：同意；reject：拒绝；ban：被封禁
            if (res[key] === "accept") {
              wx.showToast({
                title: "授权成功，可接收通知",
                icon: "success"
              });
              // ========== 授权成功后，建议在这里执行一次登录存openid ==========
              this.getCodeAndOpenid()
            } else if (res[key] === "reject") {
              wx.showToast({
                title: "已拒绝，无法接收提醒",
                icon: "none"
              });
            }
          }
        },
        fail: (err) => {
          console.error("订阅调用失败：", err);
          wx.showToast({
            title: "授权异常",
            icon: "none"
          });
        }
      })
    },
  
    // 配套：获取code 发给NodeRED换取openid（复用你上一步的逻辑）
    getCodeAndOpenid() {
      wx.login({
        success: (res) => {
          if(!res.code) return;
          console.log("获取code成功：", res.code);
          wx.request({
            url:this.data.Http_URL,
            method: "POST",
            data: { code: res.code },
            success: (result) => {
                console.log("获取openid成功：", result.data.openid);
                wx.showToast({ title: "授权完成" });
              },
              fail: (err) => {
                console.log("失败：", err);
              }
          })
        }
      })
    }
  })