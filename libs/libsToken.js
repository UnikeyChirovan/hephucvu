require("dotenv").config();
const jwt = require("jsonwebtoken");
// Random code Token
exports.generateAccessToken = (user) => {
  return new Promise((resolve, reject) => {
    jwt.sign(
      user,
      process.env.TOKEN_SECRET,
      { expiresIn: "24h" },
      (error, token) => {
        if (error) {
          reject(error);
        } else {
          resolve(token);
        }
      }
    );
  });
};

// Check code Token
exports.verifyToken = (token) => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, process.env.TOKEN_SECRET, (error, decoded) => {
      if (error) {
        reject(error);
      } else {
        resolve(decoded);
      }
    });
  });
};

// Test Check code Token
// let codeToken=`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Im5hdHVhbkBnbWFpbC5jb20iLCJwd2QiOiJ0dWFuQDEyMzQ1NiIsImlhdCI6MTcxNzIwNjI5OH0.RavogcVOdhL2Wcd_-_sataqnZVuDHJ0Z4NAWiAVPPv8`
// this.verifyToken(codeToken).then((result)=>{
//     console.log(result);
// }).catch((err)=>{
//     console.log(err);
// })

// Test generateAccessToken
// let user={
//     id:"natuan@gmail.com",
//     pwd:"tuan@123456"
// }
// this.generateAccessToken(user).then((result)=>{
//     console.log(result);
// }).catch((err)=>{
//     console.log(err);
// })
