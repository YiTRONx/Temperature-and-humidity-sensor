// pages/my/my.js
const app = getApp();
const defaultAvatarUrl = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'
Page({

  /**
   * 页面的初始数据
   */
  data: {
    avatarUrl: defaultAvatarUrl,
    nickName:'未登录',
    userUniqueId: '', // 用户唯一标识
    IsLogin:false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const UserItem = wx.getStorageSync("UserItem");
    console.log("读取本地用户数据：", UserItem);
    if (UserItem=='') {
        console.log('用户数据为空')
        app.globalData.IsLogin=false;
        this.data.IsLogin=false;
        wx.navigateTo({
            url: '/pages/login/login',
          });
    }
    else{
        console.log('用户数据为',UserItem)
        app.globalData.IsLogin=true;
        this.setData({
            avatarUrl:UserItem.avatarUrl,
            nickName:UserItem.nickName,
            userUniqueId:UserItem.userUniqueId,
            IsLogin:true
        })
        console.log('已同步页面用户数据')
    }
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
    // const UserItem = wx.getStorageSync("UserItem");
    // if (UserItem=='') {
    //     console.log('用户数据为空')
    //     app.globalData.IsLogin=false;
    //     wx.navigateTo({
    //         url: '/pages/login/login',
    //       });
    // }
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
  userinfo(e){
    if (this.data.IsLogin) {
        wx.navigateTo({
            url: '/pages/my/mydetailed/mydetailed',
          });
    }
    else{
        wx.navigateTo({
            url: '/pages/login/login',
          });
    }
  },
  mygeneral(e){
    wx.navigateTo({
        url: '/pages/my/mygeneral/mygeneral',
      });
    },

  mynotice(e){
    wx.navigateTo({
        url: '/pages/my/mynotice/mynotice',
      });
  },

  myhelp(e){
    wx.navigateTo({
        url: '/pages/my/myhelp/myhelp',
      });
  },

  unlog (e) {
    wx.setStorageSync('UserItem','');
    app.globalData.IsLogin=false;
    this.setData({
        IsLogin:false,
    })
    wx.reLaunch({
        url: '/pages/my/my',
        });
  }
})
