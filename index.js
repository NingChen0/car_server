var express = require('express')
var serveIndex = require('serve-index')
var serveStatic = require('serve-static')
var multiparty = require('multiparty')
var finalhandler = require('finalhandler')
const path = require("path");
var util = require('util')
var fs = require('fs')
let mysql = require("mysql");
var db = require('./db.js');//加载文件模块，使用暴露出来的conn
var utils = require('./utils/utils.js');//加载文件模块，使用暴露出来的conn
// node后台通过multer接收vue+elementui上传的图文表单
const multer = require('multer')
//上传文件临时文件夹
var upload_tmp = multer({ dest: 'upload/temp' });
//引入封装好的jwt模块
const Token = require('./jwt')

var LOCAL_BIND_PORT = 3000
var app = express()
const bodyParaser = require('body-parser');
const { response } = require('express')
app.use(bodyParaser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'static')));
// 跨域
//设置跨域访问
app.all('*', function (req, res, next) {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Content-Length, Authorization,Origin,Accept,X-Requested-With');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.header('Access-Control-Allow-Credentials', true);
  res.header('X-Powered-By', ' 3.2.1');
  res.header('Content-Type', 'application/json;charset=utf-8');
  res.header("Access-Control-Expose-Headers", "Authorization");//如果前端需要获取自定义的响应头的话，需要服务器端设置Access-Control-Expose-Headers
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});
//token验证/users/imgUpload
app.use((req, res, next) => {
  if (req.url.includes('login') || req.url.includes('/users/add') || req.url.includes('/users/imgUpload')) {
    next()
    return
  }
  // console.log(req.headers);
  const token = req.headers['authorization']?.split(" ")[1];//不存在authorization，则不执行本条
  // console.log(token);
  if (token != 'null') {
    // console.log("11+"+token);
    const payload = Token.verify(token);
    console.log("payload+" + payload.token);
    if (payload.token) {
      //重新计算token时间
      const newToken = Token.generate({ id: payload.id, name: payload.name }, '1h')
      res.header("Authorization", newToken);
      // console.log('ssucdess');
      next();
    } else {
      // console.log(401);
      res.status(401).send({ errCode: -1, errInfo: 'token过期' })
    }

  } else {
    res.status(401).send({ errCode: -1, errInfo: 'token过期' });

  }
})


//服务器接收到login///post请求
app.post('/login', (req, res) => {
  console.log(req.body);
  let data = req.body;
  let createTime = req.body.createTime2;
  let accuntName = req.body.name;
  var sql = "select * from account where accountNum=? and password=?";

  //登录操作
  let sqlParam = [data.name, data.password]
  db.conn.query(sql, sqlParam, (err, result) => {

    if (err) {
      return console.log(err);
    }
    // console.log(result);
    let user = result[0];//取查找出的账户名
    // console.log(user);
    if (!user) { //账号非法
      return res.send(400)
    } else { //登陆成功
      //jwt
      const token = Token.generate({ id: user.id, name: user.accuntNum }, '1h');
      // console.log(token);
      res.header("Authorization", token);
      if (user.accountFlag == 1 || user.accountFlag == 2) {
        //时间线
        let sql3 = 'INSERT INTO `timeline`(`timestamp`,`content`,flag) VALUES(?,?,?)';
        //添加时间线记录
        db.conn.query(sql3, [createTime, utils.dateState() + `<b>` + user.userName + `</b>`, 1], (err, result) => {
          if (err) {
            return console.log(err);
          }
          console.log(result);
          
          // return res.send(result);
        })
      }

      res.send({ id: user.id, name: data.name, userName: user.userName, tou_img: user.tou_img, car_id: user.car_id, accountFlag: user.accountFlag });

    }
  });


});
//account或区账户
// app.post('/getAccount', (req, res) => {
//   console.log(req.body.id);
//   let id = req.body.id;
//   //查询账户`
//   let sql = 'select * from account where id=?';
//   db.conn.query(sql, [id], (err, result) => {
//     if (err) {
//       return console.log(err);
//     }
//     console.log(result);
//     return res.send(result);
//   })

// })
//account账户修改

app.post('/reqAccount', (req, res) => {
  console.log(req.body.id);
  let id = req.body.id;
  //查询账户`
  let sql = 'select * from account where id=?';
  db.conn.query(sql, [id], (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    return res.send(result);
  })

})

//管理员头像修改
const adminImg = multer({ dest: "E:/2022/car_maintenance/src/assets/adminImg/" }) // 定义图片文件存储位置
let adminImgurl = "";
let oldimgurl = "";
let id = "";
app.post('/adminImg', adminImg.single('file'), async (req, res) => {
  console.log(req.body);
  if (req.body.imageUrl != undefined) {
    id=req.body.id;
    oldimgurl = req.body.imageUrl;
  }


  console.log(oldimgurl, "旧图像");
  console.log(req.file);
  if (req.file != undefined) {
    console.log("接收图片");
    let file = req.file;
    let basePath = "E:/2022/car_maintenance/src/assets/adminImg/"; // 设置初始路径
    let oldFileName = file.filename // 获取文件名
    let newFileName = oldFileName + '.png' // 将文件名设置成时间戳png格式
    let filePath = basePath + oldFileName; // 源文件路径
    let newFilePath = basePath + newFileName; // 新文件路径
    if (fs.existsSync(basePath)) { // 判断该目录是否存在，若存在执行文件重命名操作
      // console.log("存在!");
      fs.rename(filePath, newFilePath, (err) => {
        if (err) throw err
      })
    }
    adminImgurl = newFileName; // 设置文件相对路径用于存入数据库
    console.log(adminImgurl, "图像路径");
    if (oldimgurl != undefined) {
      fs.unlinkSync(`E:/2022/car_maintenance/src/assets/adminImg/` + oldimgurl);
      oldimgurl = undefined;
    }



  }

  if (adminImgurl != "") {
    //修改头像`
    console.log(adminImgurl, "图像名2");
    let sql1 = "UPDATE `account` SET `tou_img`=? WHERE id =?";
    db.conn.query(sql1, [adminImgurl, id], (err, result) => {
      if (err) {
        return console.log(err);
      }
      console.log(sql1);
      console.log(result);
      console.log("修改头像?");

      return res.send(adminImgurl);
    })
  }
  //将文件复制小程序端
  // return res.send();

})


//account账户修改 editAccount
app.post('/editAccount', (req, res) => {
  console.log(req.body);
  let id = req.body.id;
  let password = req.body.Newpwd;
  let userName = req.body.userName;
  //查询账户`
  let sql = 'UPDATE `account` SET `userName`=?,`password`=? WHERE id =?';
  db.conn.query(sql, [userName, password, id], (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    return res.send(result);
    // return res.end();
  })

})



//index/worktable
app.post('/worktable', (req, res) => {
  //最近订单数据
  let sql = 'select * from order1 order by id desc limit 5';
  db.conn.query(sql, (err, result) => {
    if (err) {
      return console.log(err);
    }
    // console.log(result);
    return res.send(result);
  })

})
//获取今日订单数据
app.post('/order/today', (req, res) => {

  let sql = 'SELECT * FROM `order1` WHERE TO_DAYS(createTime) = TO_DAYS(NOW())';
  db.conn.query(sql, (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    return res.send(result);
  })

})
//获取本月订单数据
app.post('/order/month', (req, res) => {

  let sql = "SELECT * FROM order1 WHERE DATE_FORMAT( createTime, '%Y-%m' ) = DATE_FORMAT( CURDATE( ) , '%Y-%m' )";
  db.conn.query(sql, (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    return res.send(result);
  })


})
//本月订单分类数据
app.post('/order/month/sort', (req, res) => {

  let sql2 = "SELECT sort, COUNT(*) as sum FROM   order1 WHERE DATE_FORMAT( createTime, '%Y-%m' ) = DATE_FORMAT( CURDATE( ) , '%Y-%m' ) GROUP BY sort;";

  db.conn.query(sql2, (err, result2) => {
    if (err) {
      return console.log(err);
    }
    console.log(result2);
    return res.send(result2);
  })

})
//所有订单分类数据
app.post('/order/sort', (req, res) => {

  let sql2 = "SELECT sort as name, COUNT(*) as value FROM   order1  GROUP BY sort";

  db.conn.query(sql2, (err, result2) => {
    if (err) {
      return console.log(err);
    }
    console.log(result2);
    return res.send(result2);
  })

})
//获取本周订单数据
app.post('/order/week', (req, res) => {

  // let sql="SELECT * FROM order1 WHERE YEARWEEK(date_format(createTime,'%Y-%m-%d')) = YEARWEEK(now())";
  let sql = `SELECT a.date,
            IFNULL( b.count, 0 ) AS count 
          FROM
            (
            SELECT
              CURDATE() AS date UNION ALL
            SELECT
              DATE_SUB( CURDATE(), INTERVAL 1 DAY ) AS date UNION ALL
            SELECT
              DATE_SUB( CURDATE(), INTERVAL 2 DAY ) AS date UNION ALL
            SELECT
              DATE_SUB( CURDATE(), INTERVAL 3 DAY ) AS date UNION ALL
            SELECT
              DATE_SUB( CURDATE(), INTERVAL 4 DAY ) AS date UNION ALL
            SELECT
              DATE_SUB( CURDATE(), INTERVAL 5 DAY ) AS date UNION ALL
            SELECT
              DATE_SUB( CURDATE(), INTERVAL 6 DAY ) AS date 
            ) a
            LEFT JOIN (
            SELECT
              date_format( createTime, '%Y-%m-%d' ) AS date,
              count( 1 ) AS count 
            FROM
              order1 
            WHERE
              createTime >= date(
              now()) - INTERVAL 7 DAY 
            GROUP BY
              DAY ( createTime ) 
            ) b ON a.date = b.date 
          ORDER BY
            a.date asc`;
  db.conn.query(sql, (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    return res.send(result);
  })

})
//工作台时间线
app.post('/timeline', (req, res) => {
  let sql = 'select * from timeline ORDER BY id ASC';
  db.conn.query(sql, (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    return res.send(result);
  })

})
//index/order订单
app.post('/order', (req, res) => {
  //最近订单数据
  console.log(req.body.mainflag);
  let sql = 'select * from order1 where mainstate=? order by id desc';
  db.conn.query(sql, req.body.mainflag, (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    return res.send(result);
  })

})
//index/order小程序（用户）订单获取
app.post('/order/user', (req, res) => {
  //最近订单数据
  console.log(req.body.car_id);
  // let sql = 'select * from order1 where car_id=? ';
  let sql2 = "SELECT O.*,r.carImg,O.car_id FROM `order1` AS O INNER JOIN `user` AS r on O.car_id= r.carId WHERE O.car_id=? order by O.id desc"
  db.conn.query(sql2, req.body.car_id, (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    return res.send(result);
  })

})
//index/order小程序维修人员订单获取入口
app.post('/weApp/order', (req, res) => {
  //最近订单数据
  console.log(req.body, '222333');
  let sql = 'select * from order1 where mainstate=? and serviceman=? order by id desc';
  db.conn.query(sql, [req.body.mainflag, req.body.serviceman], (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    return res.send(result);
  })

})
//小程序端添加订单
app.post('/order/Appadd', (req, res) => {
  console.log(req.body, "5555555");
  //时间戳
  let date = new Date();
  var mainNum = date.getTime();//维修编号
  console.log(mainNum, "时间");
  var accuName = req.body.userName;//用户名
  var detail = req.body.detail;//维修详情
  var part = "";//空
  var car_id = req.body.car_id;
  var paystate = "未支付";//支付状态
  var price = "";//空
  var serviceman = "";//空
  var createTime = req.body.createTime;//时间
  var sort = req.body.sort;//类
  var mainstate = "配件出库中";//固定
  let sql = 'INSERT INTO `order1`(`accuName`,`detail`,mainNum,part,paystate,price,serviceman,mainstate,createTime,sort,car_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)';

  db.conn.query(sql, [accuName, detail, mainNum, part, paystate, price, serviceman, mainstate, createTime, sort, car_id], (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    return res.send(result);
  })

})
//添加订单
app.post('/order/add', (req, res) => {
  console.log(req.body);
  //时间戳
  let date = new Date();
  var mainNum = date.getTime();//维修编号
  console.log(mainNum, "时间");
  var accuName = req.body.accuName;
  var detail = req.body.detail;
  var part = req.body.part;
  var car_id = req.body.car_id;
  var paystate = req.body.paystate;
  var price = req.body.price;
  var serviceman = req.body.serviceman;
  var createTime = req.body.createTime;
  var sort = req.body.sort;
  var accuntName = req.body.accuntName;
  var mainstate = "配件出库中";
  let sql = 'INSERT INTO `order1`(`accuName`,`detail`,mainNum,part,paystate,price,serviceman,mainstate,createTime,sort,car_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)';
  let sql2 = 'INSERT INTO `timeline`(`timestamp`,`content`,flag) VALUES(?,?,?)';
  //添加时间线记录
  db.conn.query(sql2, [createTime, `管理员<b>` + accuntName + `</b>-添加了一个新订单`, 1], (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    // return res.send(result);
  })
  //更新维修人员任务数
  let sql3 = "UPDATE `employee` SET task=task+1 WHERE name =?";
  db.conn.query(sql3, [serviceman], (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    // return res.send(result);
  })


  db.conn.query(sql, [accuName, detail, mainNum, part, paystate, price, serviceman, mainstate, createTime, sort, car_id], (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    return res.send(result);
  })

})
//新订单配件出库
app.post('/order/edit', (req, res) => {
  // console.log(req.body); 
  var id = req.body.id;
  var partName = req.body.partName;
  // console.log(partName,"pop"); 
  var mainstate = req.body.mainstate;
  var createTime = req.body.createTime;
  var accuntName = req.body.accuntName;
  // let sql2="UPDATE order1 O, parts P SET O.mainstate =?,P.stock=P.stock-1 WHERE O.productid= pp.productId;"
  let sql = "UPDATE `order1` SET `mainstate`=? WHERE id =?";
  let partArr = partName.split('、');
  console.log(partArr);
  let sql2 = "UPDATE `parts` SET Stock=Stock-1 WHERE partName =?";
  let sql3 = 'INSERT INTO `timeline`(`timestamp`,`content`,flag) VALUES(?,?,?)';
  //添加时间线记录
  db.conn.query(sql3, [createTime, `管理员<b>` + accuntName + `</b>-领料出库了一个订单`, 1], (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    // return res.send(result);
  })
  //更新订单列表
  db.conn.query(sql, [mainstate, id], (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
  })
  //配件出库
  for (let i = 0; i < partArr.length; i++) {
    db.conn.query(sql2, [partArr[i]], (err, result2) => {
      if (err) {
        return console.log(err);
      }
      console.log(result2);
    })

  }

  return res.end();


})
//order编辑订单
app.post('/order/toedit', (req, res) => {
  console.log(req.body);
  var id = req.body.id;
  var createTime2 = req.body.createTime2;
  var accuntName = req.body.accuntName;
  var mainNum = req.body.mainNum;
  var detail = req.body.detail;
  var car_id = req.body.car_id;
  var part = req.body.part;
  var accuName = req.body.accuName;
  var price = req.body.price;
  var paystate = req.body.paystate;
  var old_serviceman = req.body.old_serviceman;
  var serviceman = req.body.serviceman;
  var sort = req.body.sort;
  // return res.send()
  let sql3 = 'INSERT INTO `timeline`(`timestamp`,`content`,flag) VALUES(?,?,?)';
  //添加时间线记录
  db.conn.query(sql3, [createTime2, `管理员<b>` + accuntName + `</b>-编辑了一个订单`, 1], (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    // return res.send(result);
  })
  //更新维修人员任务数
  let sql4 = "UPDATE `employee` SET task=task-1 WHERE name =?";
  db.conn.query(sql4, [old_serviceman], (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    // return res.send(result);
  })
  let sql2 = "UPDATE `employee` SET task=task+1 WHERE name =?";
  db.conn.query(sql2, [serviceman], (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    // return res.send(result);
  })
  let sql = "UPDATE `order1` SET `mainNum`=?,`detail`=?,`car_id`=?,`accuName`=?,`part`=?,`price`=?, `paystate`=?,`serviceman`=?,`sort`=? WHERE id =?";
  db.conn.query(sql, [mainNum, detail, car_id, accuName, part, price, paystate, serviceman, sort, id], (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    return res.send(result);
  })

})



//取消订单
app.post('/order/delete', (req, res) => {
  console.log(req.body);
  var id = req.body.id;
  var serviceman = req.body.serviceman;
  var createTime = req.body.createTime2;
  var accuntName = req.body.accuntName;
  let sql = "DELETE FROM `order1` WHERE id =?";
  let sql3 = 'INSERT INTO `timeline`(`timestamp`,`content`,flag) VALUES(?,?,?)';
  //添加时间线记录
  db.conn.query(sql3, [createTime, `管理员<b>` + accuntName + `</b>-取消了一个订单`, 1], (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    // return res.send(result);
  })
  //更新维修人员任务数
  let sql2 = "UPDATE `employee` SET task=task-1 WHERE name =?";
  db.conn.query(sql2, [serviceman], (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    // return res.send(result);
  })

  //删除订单
  db.conn.query(sql, [id], (err, result) => {
    if (err) {
      return console.log(err);
    }
    return res.send(result);
  })

})
//index/ordering维修中订单
app.post('/ordering', (req, res) => {
  //最近订单数据
  console.log(req.body.mainflag);
  let sql = 'select * from order1 where mainstate=?';
  db.conn.query(sql, req.body.mainflag, (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    return res.send(result);
  })

})
//维修中订单完成维修
app.post('/ordering/edit', (req, res) => {
  console.log(req.body);
  var id = req.body.id;
  var mainstate = req.body.mainstate;
  var serviceman = req.body.serviceman;
  var createTime = req.body.createTime;
  var accuntName = req.body.accuntName;
  let sql3 = 'INSERT INTO `timeline`(`timestamp`,`content`,flag) VALUES(?,?,?)';
  //添加时间线记录
  db.conn.query(sql3, [createTime, `管理员<b>` + accuntName + `</b>-操作完成了一个订单`, 1], (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    // return res.send(result);
  })
  //更新维修人员任务数
  let sql4 = "UPDATE `employee` SET task=task-1 WHERE name =?";
  db.conn.query(sql4, [serviceman], (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    // return res.send(result);
  })
  let sql = "UPDATE `order1` SET `mainstate`=?,`finishTime`=? WHERE id =?";
  db.conn.query(sql, [mainstate, createTime, id], (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    return res.send(result);
  })

})


//小程序中订单完成支付
app.post('/order/Appedit', (req, res) => {
  console.log(req.body);
  // res.end();
  var id = req.body.id;
  var paystate = "已支付";
  let sql = "UPDATE `order1` SET `paystate`=? WHERE id =?";
  db.conn.query(sql, [paystate, id], (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    return res.send(result);
  })

})
//维修完成//==维修中订单完成支付
app.post('/ordered/edit', (req, res) => {
  console.log(req.body);
  var id = req.body.id;
  var paystate = req.body.paystate;
  var createTime = req.body.createTime;
  var accuntName = req.body.accuntName;
  let sql3 = 'INSERT INTO `timeline`(`timestamp`,`content`,flag) VALUES(?,?,?)';
  //添加时间线记录
  db.conn.query(sql3, [createTime, `管理员<b>` + accuntName + `</b>-操作完成支付了一个订单`, 1], (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    // return res.send(result);
  })

  let sql = "UPDATE `order1` SET `paystate`=? WHERE id =?";
  db.conn.query(sql, [paystate, id], (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    return res.send(result);
  })

})
//index/ordered已完成订单
app.post('/ordered', (req, res) => {
  //最近订单数据
  console.log(req.body.mainflag);
  let sql = 'select * from order1 where mainstate=?';
  db.conn.query(sql, req.body.mainflag, (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    return res.send(result);
  })

})



//employee
app.post('/employee', (req, res) => {

  let sql = 'select * from employee INNER JOIN account on employee.`name`=account.userName';
  db.conn.query(sql, (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    return res.send(result);
  })

})
//添加员工
app.post('/addEmployee', (req, res) => {
  console.log(req.body);
  var name = req.body.name;
  var accountNum = req.body.accountNum;
  var password = req.body.password;
  var sex = req.body.sex;
  var birthday = req.body.birthday;
  var address = req.body.address;
  var Edate = req.body.Edate;
  var department = req.body.department;
  var createTime2 = req.body.createTime;
  var accuntName = req.body.accuntName;
  let sql3 = 'INSERT INTO `timeline`(`timestamp`,`content`,flag) VALUES(?,?,?)';
  //添加时间线记录
  db.conn.query(sql3, [createTime2, `管理员<b>` + accuntName + `</b>-新增了一个新员工`, 1], (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    // return res.send(result);
  })
  let sql2 = 'INSERT INTO `account`(`accountNum`,`password`,accountFlag,name) VALUES(?,?,?,?)';
  db.conn.query(sql2, [accountNum, password, 4,name], (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    // return res.send(result);
  })
  let sql = 'INSERT INTO `employee`(`name`,`sex`,birthday,address,Edate,department) VALUES(?,?,?,?,?,?)';
  db.conn.query(sql, [name, sex, birthday, address, Edate, department], (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    return res.send(result);
  })

})
//编辑员工
app.post('/employee/edit', (req, res) => {
  console.log(req.body);
  var id = req.body.id;
  var empid = req.body.empid;
  var accountNum = req.body.accountNum;
  var password= req.body.password;
  var name = req.body.name;
  var sex = req.body.sex;
  var birthday = req.body.birthday;
  var address = req.body.address;
  var Edate = req.body.Edate;
  var department = req.body.department;
  var createTime2 = req.body.createTime;
  var accuntName = req.body.accuntName;
  let sql3 = 'INSERT INTO `timeline`(`timestamp`,`content`,flag) VALUES(?,?,?)';
  //添加时间线记录
  db.conn.query(sql3, [createTime2, `管理员<b>` + accuntName + `</b>-修改了一个员工数据`, 1], (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    // return res.send(result);
  })
  let sql2 = "UPDATE `account` SET `accountNum`=?,`password`=?,userName =?WHERE id =?";
  db.conn.query(sql2, [accountNum, password, name, id], (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    // return res.send(result);
  })
  let sql = "UPDATE `employee` SET `name`=?,`sex`=?,`birthday`=?,`address`=?,`Edate`=?,`department`=? WHERE empid =?";
  db.conn.query(sql, [name, sex, birthday, address, Edate, department, empid], (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    return res.send(result);
  })

})
//删除员工
app.post('/employee/delete', (req, res) => {
  console.log(req.body);
  var id = req.body.id;
  var empid = req.body.empid;
  var createTime2 = req.body.createTime;
  var accuntName = req.body.accuntName;
  let sql3 = 'INSERT INTO `timeline`(`timestamp`,`content`,flag) VALUES(?,?,?)';
  //添加时间线记录
  db.conn.query(sql3, [createTime2, `管理员<b>` + accuntName + `</b>-删除了一个员工`, 1], (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    // return res.send(result);
  })
  //删除账户
  let sql2 = "DELETE FROM `account` WHERE id =?";
  db.conn.query(sql2, [id], (err, result) => {
    if (err) {
      return console.log(err);
    }
    // return res.send(result);
  })
  let sql = "DELETE FROM `employee` WHERE empid =?";
  db.conn.query(sql, [empid], (err, result) => {
    if (err) {
      return console.log(err);
    }
    return res.send(result);
  })

})
//users//获取用户信息列表
app.post('/users', (req, res) => {
  let sql = 'select * from `account` inner join `user` on account.`car_id` = user.`carId`';
  db.conn.query(sql, (err, result) => {
    if (err) {
      return console.log(err);
    }

    return res.send(result);
  })

})











//添加用户图片接收
const userUpload = multer({ dest: "E:/2022/car_maintenance/src/assets/car_images/" }) // 定义图片文件存储位置
let userImgurl = "";
app.post('/users/imgUpload', userUpload.single('file'), async (req, res) => {
  // console.log(req.body);
  console.log(req.file);
  console.log("接收图片");
  let file = req.file;
  let basePath = "E:/2022/car_maintenance/src/assets/car_images/"; // 设置初始路径
  let oldFileName = file.filename // 获取文件名
  let newFileName = oldFileName + '.png' // 将文件名设置成时间戳png格式
  let filePath = basePath + oldFileName; // 源文件路径
  let newFilePath = basePath + newFileName; // 新文件路径
  if (fs.existsSync(basePath)) { // 判断该目录是否存在，若存在执行文件重命名操作
    // console.log("存在!");
    fs.rename(filePath, newFilePath, (err) => {
      if (err) throw err
    })
  }
  userImgurl = newFileName; // 设置文件相对路径用于存入数据库
  console.log(userImgurl, 222);
  //将文件复制小程序端
  /**
  * 复制文件
  * 参数说明： 接收一个 options 对象作为参数，该对象包含三个属性
  * - fromPath：源文件路径
  * - toPath：要复制过去的新路径
  * - filename：文件名
  */
  function copyFiles(options = { filename: userImgurl }) {
    // 对参数进行解构，并设置默认值
    const { fromPath = 'E:/2022/car_maintenance/src/assets/car_images/', toPath = "E:/weixin_app/car_2022/images/Bmw/", filename } = options;
    let sourceFile = path.join(fromPath, filename);
    let destPath = path.join(toPath, filename);
    // 当 toPath 所对应目录不存在时，则自动创建该文件
    try {
      fs.accessSync(toPath);
    } catch (error) {
      fs.mkdirSync(toPath);
    }
    let readStream = fs.createReadStream(sourceFile);
    let writeStream = fs.createWriteStream(destPath);
    readStream.pipe(writeStream);
  }
  copyFiles();
  //复制结束

  return res.send();


})
//添加用户（包括小程序端）
app.post('/users/add', async (req, res) => {
  console.log(req.body);
  var name = req.body.name;
  var password = req.body.password;
  var account = req.body.account;
  var email = req.body.email;
  var sex = req.body.sex;
  var carId = req.body.carId;
  var adress = req.body.adress;
  let carImg = userImgurl;
  let flag = true;
  // 校验用户名和车牌是否被占用
  let sql2 = 'select * from account';
  db.conn.query(sql2, (err, result) => {
    if (err) {
      return console.log(err);
    }
    // console.log(result,'2222222');
    for (let i = 0; i < result.length; i++) {
      if (result[i].accountNum == account) {
        let data = {
          meta: '用户名已被占用'
        }
        flag = false;
        return res.send(data);
      }
      //校验车牌
      if (result[i].car_id == carId) {
        let data = {
          meta: '该车牌已被占用'
        }
        flag = false;
        return res.send(data);
      }

    }
    if (flag) {
      let sql3 = 'INSERT INTO `account`(`accountNum`,`password`,accountFlag,userName,car_id) VALUES(?,?,?,?,?)';
      db.conn.query(sql3, [account, password, "4", name, carId], (err, result) => {
        if (err) {
          return console.log(err);
        }
        console.log(result);

      })

      let sql = 'INSERT INTO `user`(`userName`,`sex`,carId,adress,email,carImg) VALUES(?,?,?,?,?,?)';
      db.conn.query(sql, [name, sex, carId, adress, email, carImg], (err, result) => {
        if (err) {
          return console.log(err);
        }
        console.log(result);
        return res.send(result);
      })
    }
  })

})
//小程序端获取用户信息
app.post('/AppUser', (req, res) => {
  console.log(req.body);

  var carId = req.body.carId;

  let sql = "select * from `user` inner join `account`on user.`carId` = account.`car_id`WHERE user.carId=?";
  db.conn.query(sql, [carId], (err, result) => {
    if (err) {
      return console.log(err);
    }
    // console.log(result);
    return res.send(result);
  })

})
//小程序端编辑用户
app.post('/Appusers/edit', (req, res) => {
  console.log(req.body,"编辑");
  var name = req.body.name;
  var email = req.body.email;
  var sex = req.body.sex;
  var carId = req.body.carId;
  var adress = req.body.adress;
  var password = req.body.password;
  var account = req.body.account;
  let sql = "UPDATE `user` SET `userName`=?,`sex`=?,`adress`=?,`email`=? WHERE carId =?";
  let sql3 = "UPDATE `order1` SET `accuName`=?WHERE car_id =?";
  let sql2 = "UPDATE `account` SET `userName`=?,`password`=? WHERE car_id =?";
  db.conn.query(sql2, [name, password, carId,], (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
  })
  db.conn.query(sql3, [name, carId,], (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
  })
  db.conn.query(sql, [name, sex, adress, email, carId,], (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    return res.send(result);
  })


})
//管理员头像修改
// const UserImg = multer({ dest: "E:/2022/car_maintenance/src/assets/car_images/" }) // 定义图片文件存储位置
// let UserImgurl = "";
// let oldUserimgurl = "";
// let id ="";
// let name = "";
// let email = "";
// let sex = "";
// let carId = "";
// let adress = "";
// app.post('/users/edit', UserImg.single('file'), async (req, res) => {
//   console.log(req.body);
//   let id = req.body.id;
//   if (req.body.imageUrl != undefined) {
//     id = req.body.id;
//     name = req.body.userName;
//     email = req.body.email;
//     sex = req.body.sex;
//     carId = req.body.carId;
//     adress = req.body.adress;
//   }


//   console.log(oldUserimgurl, "旧图像");
//   console.log(req.file);
//   if (req.file != undefined) {
//     console.log("接收图片");
//     let file = req.file;
//     let basePath = "E:/2022/car_maintenance/src/assets/car_images/"; // 设置初始路径
//     let oldFileName = file.filename // 获取文件名
//     let newFileName = oldFileName + '.png' // 将文件名设置成时间戳png格式
//     let filePath = basePath + oldFileName; // 源文件路径
//     let newFilePath = basePath + newFileName; // 新文件路径
//     if (fs.existsSync(basePath)) { // 判断该目录是否存在，若存在执行文件重命名操作
//       // console.log("存在!");
//       fs.rename(filePath, newFilePath, (err) => {
//         if (err) throw err
//       })
//     }
//     UserImgurl = newFileName; // 设置文件相对路径用于存入数据库
//     console.log(oldUserimgurl, "图像路径");
//     if (oldimgurl != undefined) {
//       fs.unlinkSync(`E:/2022/car_maintenance/src/assets/car_images/` + oldUserimgurl);
//       oldimgurl = undefined;
//     }



//   }

//   if (UserImgurl != "") {
//     //修改头像`
//     console.log(UserImgurl, "图像名2");
//     // let sql1 = "UPDATE `account` SET `carImg`=? WHERE id =1";
//     // db.conn.query(sql1, [UserImgurl, id], (err, result) => {
//     //   if (err) {
//     //     return console.log(err);
//     //   }
//     //   console.log(sql1);
//     //   console.log(result);
//     //   console.log("修改头像?");

//     //   return res.send(UserImgurl);
//     // })
//     let sql = "UPDATE `user` SET `userName`=?,`sex`=?,`carId`=?,`adress`=?,`email`=?,`carImg`=? WHERE id =?";
//     db.conn.query(sql, [name, sex, carId, adress, email,UserImgurl,id], (err, result) => {
//       if (err) {
//         return console.log(err);
//       }
//       console.log(result);
//       return res.send(UserImgurl);
//     })
//   }
//   //将文件复制小程序端
//   // return res.send();

// })





//编辑用户
app.post('/users/edit', (req, res) => {
  console.log(req.body,"编辑用户");
  var id = req.body.id;
  var name = req.body.userName;
  var email = req.body.email;
  var sex = req.body.sex;
  var carId = req.body.carId;
  var adress = req.body.adress;
  let sql = "UPDATE `user` SET `userName`=?,`sex`=?,`carId`=?,`adress`=?,`email`=? WHERE id =?";
  db.conn.query(sql, [name, sex, carId, adress, email, id], (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    return res.send(result);
  })

})
//删除用户
app.post('/users/delete', (req, res) => {
  // console.log(req.body); 
  var id = req.body.id;
  var carId = req.body.carId;
  let sql2 = "DELETE FROM `account` WHERE car_id =?";
  db.conn.query(sql2, [carId], (err, result) => {
    if (err) {
      return console.log(err);
    }
    // return res.send(result);
  })
  let sql = "DELETE FROM `user` WHERE id =?";
  db.conn.query(sql, [id], (err, result) => {
    if (err) {
      return console.log(err);
    }
    return res.send(result);
  })

})
//placement（工作台）
app.post('/placement', (req, res) => {

  let sql = 'select * from placement';
  db.conn.query(sql, (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    return res.send(result);
  })

})
//parts
app.post('/parts', (req, res) => {

  let sql = 'select * from parts order by id desc';
  db.conn.query(sql, (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    return res.send(result);
  })

})
//添加零件
// node后台通过multer接收vue+elementui上传的图文表单
//图片接收
const upload = multer({ dest: "E:/2022/car_maintenance/src/assets/car_parts/" }) // 定义图片文件存储位置
let imgurl = "";
app.post('/imgupload', upload.single('file'), (req, res) => {
  // console.log(req.body);
  console.log(req.file)
  let file = req.file;
  let basePath = "E:/2022/car_maintenance/src/assets/car_parts/"; // 设置初始路径
  let oldFileName = file.filename // 获取文件名
  let newFileName = Date.now() + '.png' // 将文件名设置成时间戳png格式
  let filePath = basePath + oldFileName; // 源文件路径
  let newFilePath = basePath + newFileName; // 新文件路径
  if (fs.existsSync(basePath)) { // 判断该目录是否存在，若存在执行文件重命名操作
    // console.log("存在!");
    fs.rename(filePath, newFilePath, (err) => {
      if (err) throw err
    })
  }
  imgurl = newFileName; // 设置文件相对路径用于存入数据库
  console.log(imgurl, 222);
  return res.send();

})
//零件表单数据接收
app.post('/addPart', (req, res) => {
  // 上传图片的信息在req.file中
  //  console.log(req.body,'3333333')
  //  console.log(req.file)

  var partNum = req.body.partNum;
  var partName = req.body.partName;
  var purchasePrice = req.body.purchasePrice;
  var salesPrice = req.body.salesPrice;
  var stock = req.body.stock;
  var createTime = req.body.createtime;
  var createTime2 = req.body.createTime2;
  var accuntName = req.body.accuntName;
  let sql3 = 'INSERT INTO `timeline`(`timestamp`,`content`,flag) VALUES(?,?,?)';
  //添加时间线记录
  db.conn.query(sql3, [createTime2, `管理员<b>` + accuntName + `</b>-添加了一个零件`, 1], (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    // return res.send(result);
  })
  let imgurl1 = imgurl;
  let sql = "INSERT INTO `parts`(`partNum`,`partName`,`purchasePrice`,`salesPrice`,`stock`,`createTime`,imgurl) VALUES(?,?,?,?,?,?,?)";
  db.conn.query(sql, [partNum, partName, purchasePrice, salesPrice, stock, createTime, imgurl1], (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    return res.send(result);
  })

  //  return res.send();
  //   // })

})
//编辑零件
app.post('/parts/edit', (req, res) => {
  console.log(req.body);
  var id = req.body.id;
  var Stock = req.body.stock;
  var createTime = req.body.createTime;
  var partName = req.body.partName;
  var partNum = req.body.partNum;
  var purchasePrice = req.body.purchasePrice;
  var salesPrice = req.body.salesPrice;
  var createTime2 = req.body.createTime2;
  var accuntName = req.body.accuntName;
  let sql3 = 'INSERT INTO `timeline`(`timestamp`,`content`,flag) VALUES(?,?,?)';
  //添加时间线记录
  db.conn.query(sql3, [createTime2, `管理员<b>` + accuntName + `</b>-修改了一个零件数据`, 1], (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    // return res.send(result);
  })
  let sql = "UPDATE `parts` SET `Stock`=?,`createTime`=?,`partName`=?,`partNum`=?,`purchasePrice`=?,`salesPrice`=? WHERE id =?";
  db.conn.query(sql, [Stock, createTime, partName, partNum, purchasePrice, salesPrice, id], (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    return res.send(result);
  })

})

//删除零件
app.post('/part/delete', (req, res) => {
  console.log(req.body);
  var id = req.body.id;
  var createTime2 = req.body.createTime2;
  var accuntName = req.body.accuntName;
  let sql3 = 'INSERT INTO `timeline`(`timestamp`,`content`,flag) VALUES(?,?,?)';
  //添加时间线记录
  db.conn.query(sql3, [createTime2, `管理员<b>` + accuntName + `</b>-删除了一个零件`, 1], (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log(result);
    // return res.send(result);
  })
  let sql = "DELETE FROM `parts` WHERE id =?";
  db.conn.query(sql, [id], (err, result) => {
    if (err) {
      return console.log(err);
    }
    return res.send(result);
  })

})
//部门（department）
app.post('/department', (req, res) => {
  // console.log(req.body); 
  let sql = 'select * from department';
  db.conn.query(sql, (err, result) => {
    if (err) {
      return console.log(err);
    }
    return res.send(result);
  })

})
// 维修类别
app.post('/carSort', (req, res) => {
  // console.log(req.body); 
  let sql = 'select * from car_sort';
  db.conn.query(sql, (err, result) => {
    if (err) {
      return console.log(err);
    }
    return res.send(result);
  })

})
console.log(`Start static file server at ::${LOCAL_BIND_PORT}, Press ^ + C to exit`)
app.listen(LOCAL_BIND_PORT)
