var mysql=require('mysql');
var conn=mysql.createConnection({  //创建数据库连接对象conn	
	host:'localhost',
	user:'root',
	password:'',
	database:'2022car',
	timezone:'08:00'
});

conn.connect(function(err){
	if(err){
		return console.log(err);
	}
	console.log("连接ID：" + conn.threadId);
	console.log('连接成功');
});

module.exports.conn=conn;  //db.js中定义conn对象暴露出去
