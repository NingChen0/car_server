//封装jwt
const jwt = require('jsonwebtoken');
const Token = {
  generate:function(data,time){ //data加密数据，time过期时间
    return jwt.sign(data, 'token', {expiresIn:time})
  },
  verify:function(token){
    try {
      let data = jwt.verify(token, 'token');
      return {
        token:true,
        id:data.id,
        name:data.name
      };
    } catch (e) {
      return {
        token:false,
        data:e
      }

    }
  }
}
module.exports = Token;