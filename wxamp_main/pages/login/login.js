// pages/logintest/logintest.js
const defaultAvatarUrl = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'
Page({

  /**
   * 页面的初始数据
   */
  data: {
    avatarUrl: defaultAvatarUrl,
    nickName:'',
    userUniqueId: '', // 生成的用户唯一标识
    userItem:{}
  },

  chooseAvatar:function name(e) {
    console.log(e.detail.avatarUrl)
    const  inavatarUrl = e.detail.avatarUrl
    this.setData({
      avatarUrl: inavatarUrl,
    })
  },

  InputChange(e) {
    console.log(e.detail.value)
    const innickName = e.detail.value
    this.setData({
      nickName: innickName,
    })
  },
  
  getPhoneId(e) {
     const nickName=this.data.nickName
     const avatarUrl=this.data.avatarUrl
    // if (e.detail.errMsg === 'getPhoneNumber:ok') {
    //   const uniqueId = e.detail.encryptedData; // 直接用加密数据做标识
    //   this.setData({ 
    //       userUniqueId: uniqueId ,
    //       userItem:{userUniqueId: uniqueId,nickName: nickName,avatarUrl: avatarUrl}
    // });
    this.setData({ 
              userItem:{nickName: nickName,avatarUrl: avatarUrl}
        });
    console.log(this.data.userItem)
    wx.setStorageSync('UserItem', this.data.userItem);
    // }
    wx.reLaunch({
        url: '/pages/my/my',
        });
  },



  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {

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

  }
})