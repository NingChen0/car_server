const dateState =(date = new Date())=>{
    if (date.getHours() >= 6 && date.getHours() < 12) {
        return "上午好！"
    } else if (date.getHours() >= 12 && date.getHours() < 18) {
        return "下午好！"
    } else {
        return "晚上好！"
    }
}

module.exports = {
    dateState
  }
 //db.js中定义dateState暴露出去
