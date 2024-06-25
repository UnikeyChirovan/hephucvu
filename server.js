require("dotenv").config();
// Tham chiếu đến thư viện http
const http = require("http");
// Tham chiếu đến thư viện fs Xử lý tập tin
const fs = require("fs");
// Khai báo port Services
const port = process.env.PORT; // truy xuất trong env
// Khai báo thư viện MongoDB
const db = require("./libs/mongoDB");
// Khai báo thư viện nodemailer
const sendMail = require("./libs/sendMail");
// khai báo thư viện cloudinary
const imgUpload = require("./libs/cloudinaryImages");
//khai báo thư viện jwt
const libToken = require("./libs/libsToken");
//Hàm đọc số tiền bằng chữ
const to_vietnamese = require("./libs/numberToWords");
// Thêm thư viện WebSocket
const WebSocket = require("ws");

// Lưu trữ lịch sử tin nhắn
let messageHistory = [];

const server = http.createServer((req, res) => {
  let method = req.method;
  let url = req.url;
  let kq = `Service Node - Method:${method} - Url:${url}`;
  // Cấp quyền
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,HEAD,OPTIONS,POST,PUT,DELETE"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Access-Control-Allow-Headers, Origin, Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers"
  );
  res.setHeader("Access-Control-Allow-Credentials", true);

  if (method == "GET") {
    let collectionName = db.collectionNames[url.replace("/", "")];
    console.log(collectionName);
    if (collectionName != undefined) {
      res.writeHead(200, { "Content-Type": "text/json; charset:utf8" });
      db.getAll(collectionName)
        .then((result) => {
          kq = JSON.stringify(result);
          res.end(kq);
        })
        .catch((err) => {
          kq = JSON.stringify(err);
          res.end(kq);
        });
      return;
    } else if (url.match(".png$")) {
      let imagePath = `images${url}`;
      if (!fs.existsSync(imagePath)) {
        imagePath = `images/noImage.png`;
      }
      let fileStream = fs.createReadStream(imagePath);
      res.writeHead(200, { "Content-Type": "image/png" });
      fileStream.pipe(res);
      return;
    } else if (collectionName == undefined) {
      res.end(kq);
    }
  } else if (method == "POST") {
    // Lấy dữ liệu từ client gởi về
    let noi_dung_nhan = ``;
    req.on("data", (data) => {
      noi_dung_nhan += data;
    });
    if (url == "/DATHANG") {
      req.on("end", () => {
        let dsDathang = JSON.parse(noi_dung_nhan);
        let ket_qua = { Noi_dung: [] };
        let tongTien = 0; // Khởi tạo biến tổng tiền

        dsDathang.forEach((item) => {
          let filter = {
            Ma_so: item.key,
          };
          let collectionName =
            item.nhom == 1 ? "tivi" : item.nhom == 2 ? "mobile" : "food";
          db.getOne(collectionName, filter)
            .then((result) => {
              item.dathang.So_Phieu_Dat = result.Danh_sach_Phieu_Dat.length + 1;
              result.Danh_sach_Phieu_Dat.push(item.dathang);
              let capnhat = {
                $set: { Danh_sach_Phieu_Dat: result.Danh_sach_Phieu_Dat },
              };
              let obj = {
                Ma_so: result.Ma_so,
                Update: true,
              };
              db.updateOne(collectionName, filter, capnhat)
                .then((result) => {
                  if (result.modifiedCount == 0) {
                    obj.Update = false;
                  }
                  ket_qua.Noi_dung.push(obj);
                  if (ket_qua.Noi_dung.length == dsDathang.length) {
                    // Tạo nội dung email cho người mua
                    let htmlMua = `<h4>Cảm ơn quý khách đã đặt hàng ở <span style="color:red">Cáo's Store</span></h4>`;
                    htmlMua += `<h4>Đơn đặt hàng của bạn đã được xác nhận</h4>`;
                    dsDathang.forEach((don) => {
                      tongTien += don.dathang.Tien; // Cộng dồn tổng tiền
                      let donGiaFormatted =
                        don.dathang.Don_gia_Ban.toLocaleString() + " VND";
                      let thanhTienFormatted =
                        don.dathang.Tien.toLocaleString() + " VND";
                      let tienChu = to_vietnamese(don.dathang.Tien);
                      htmlMua += `
                    <p>Mã sản phẩm: ${don.key}</p>
                    <p>Số lượng: ${don.dathang.So_luong}</p>
                    <p>Đơn giá: ${donGiaFormatted}</p>
                    <p>Thành tiền: ${thanhTienFormatted} (${tienChu})</p>
                    <p>Ngày giao hàng: ${don.dathang.Ngay_Giao_hang}</p>
                    <hr>`;
                    });

                    let tongTienFormatted = tongTien.toLocaleString() + " VND";
                    let tongTienChu = to_vietnamese(tongTien);
                    htmlMua += `<p><strong>Tổng giá tiền: ${tongTienFormatted} (${tongTienChu})</strong></p>`;

                    // Tạo nội dung email cho người bán
                    let htmlBan = `<h4>Thông tin đơn hàng mới</h4>`;
                    dsDathang.forEach((don) => {
                      let donGiaFormatted =
                        don.dathang.Don_gia_Ban.toLocaleString() + " VND";
                      let thanhTienFormatted =
                        don.dathang.Tien.toLocaleString() + " VND";
                      let tienChu = to_vietnamese(don.dathang.Tien);
                      htmlBan += `
                    <p>Mã sản phẩm: ${don.key}</p>
                    <p>Số lượng: ${don.dathang.So_luong}</p>
                    <p>Đơn giá: ${donGiaFormatted}</p>
                    <p>Thành tiền: ${thanhTienFormatted} (${tienChu})</p>
                    <p>Ngày giao hàng: ${don.dathang.Ngay_Giao_hang}</p>
                    <p>Khách hàng: ${don.dathang.Khach_hang.Ho_ten}</p>
                    <p>Email: ${don.dathang.Khach_hang.Email}</p>
                    <p>Điện thoại: ${don.dathang.Khach_hang.Dien_thoai}</p>
                    <p>Địa chỉ: ${don.dathang.Khach_hang.Dia_chi}</p>
                    <hr>`;
                    });

                    htmlBan += `<p><strong>Tổng giá tiền: ${tongTienFormatted} (${tongTienChu})</strong></p>`;

                    // Gửi email cho người mua
                    let _from = "admin@shopCao.com.vn";
                    let _toMua = dsDathang[0].dathang.Khach_hang.Email;
                    let _subjectMua = "Xác nhận đơn hàng từ Shop Cáo";
                    let _toBan = "selorson.tcv@gmail.com"; // Email của người bán
                    let _subjectBan = "Thông tin đơn hàng mới từ Shop Cáo";

                    sendMail
                      .Goi_Thu(_from, _toMua, _subjectMua, htmlMua)
                      .then((result) => {
                        console.log("Email cho người mua: ", result);
                        // Gửi email cho người bán
                        return sendMail.Goi_Thu(
                          _from,
                          _toBan,
                          _subjectBan,
                          htmlBan
                        );
                      })
                      .then((result) => {
                        console.log("Email cho người bán: ", result);
                        res.end(JSON.stringify(ket_qua));
                      })
                      .catch((err) => {
                        console.log(err);
                        ket_qua.Noi_dung.push({ error: err.message });
                        res.end(JSON.stringify(ket_qua));
                      });
                  }
                })
                .catch((err) => {
                  console.log(err);
                });
            })
            .catch((err) => {
              console.log(err);
            });
        });
      });
    } else if (url == "/LIENHE") {
      req.on("end", () => {
        let thongTin = JSON.parse(noi_dung_nhan);
        let ket_qua = { Noi_dung: true };
        let _from = "admin@shopCao.com.vn";
        let _to = "selorson.tcv@gmail.com";
        let _subject = thongTin.tieude;
        let _body = thongTin.noidung;
        sendMail
          .Goi_Thu(_from, _to, _subject, _body)
          .then((result) => {
            console.log(result);
            res.end(JSON.stringify(ket_qua));
          })
          .catch((err) => {
            console.log(err);
            ket_qua.Noi_dung = false;
            res.end(JSON.stringify(ket_qua));
          });
      });
    } else if (url == "/LOGIN") {
      req.on("end", () => {
        let ket_qua = {
          Noi_dung: true,
        };
        let user = JSON.parse(noi_dung_nhan);
        let dieukien = {
          $and: [
            { Ten_Dang_nhap: user.Ten_Dang_nhap },
            { Mat_khau: user.Mat_khau },
          ],
        };

        db.getOne("user", dieukien)
          .then((result) => {
            if (result) {
              libToken
                .generateAccessToken(result)
                .then((token) => {
                  ket_qua.Noi_dung = {
                    Ho_ten: result.Ho_ten,
                    Nhom: {
                      Ma_so: result.Nhom_Nguoi_dung.Ma_so,
                      Ten: result.Nhom_Nguoi_dung.Ten,
                    },
                    access_token: token,
                  };
                  res.writeHead(200, {
                    "Content-Type": "application/json;charset=utf-8",
                  });
                  res.end(JSON.stringify(ket_qua));
                })
                .catch((err) => {
                  console.log(err);
                  ket_qua.Noi_dung = false;
                  res.writeHead(200, {
                    "Content-Type": "application/json;charset=utf-8",
                  });
                  res.end(JSON.stringify(ket_qua));
                });
            } else {
              ket_qua.Noi_dung = false;
              res.writeHead(200, {
                "Content-Type": "application/json;charset=utf-8",
              });
              res.end(JSON.stringify(ket_qua));
            }
          })
          .catch((err) => {
            console.log(err);
            ket_qua.Noi_dung = false;
            res.writeHead(200, {
              "Content-Type": "application/json;charset=utf-8",
            });
            res.end(JSON.stringify(ket_qua));
          });
      });
    } else if (url == "/INSERT_MOBILE") {
      // Kiểm tra header Authorization
      const authorizationHeader = req.headers.authorization;
      if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
        res.writeHead(401, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Unauthorized" }));
      }

      // Lấy token từ header Authorization
      const token = authorizationHeader.split(" ")[1];

      // Xác thực token JWT
      libToken
        .verifyToken(token)
        .then((decodedToken) => {
          // Nếu xác thực thành công, tiếp tục xử lý yêu cầu
          let ket_qua = { Noi_dung: true };
          req.on("end", () => {
            let mobileNew = JSON.parse(noi_dung_nhan);
            db.insertOne("mobile", mobileNew)
              .then((result) => {
                console.log(result);
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(ket_qua));
              })
              .catch((err) => {
                ket_qua.Noi_dung = false;
                console.log(err);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify(ket_qua));
              });
          });
        })
        .catch((error) => {
          // Xử lý khi token không hợp lệ
          console.error("JWT Verification Error:", error);
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Unauthorized" }));
        });
    } else if (url == "/INSERT_TIVI") {
      req.on("end", () => {
        let ket_qua = {
          Noi_dung: true,
        };
        let tiviNew = JSON.parse(noi_dung_nhan);
        db.insertOne("tivi", tiviNew)
          .then((result) => {
            console.log(result);
            res.end(JSON.stringify(ket_qua));
          })
          .catch((err) => {
            ket_qua.Noi_dung = false;
            console.log(err);
            res.end(JSON.stringify(ket_qua));
          });
      });
    } else if (url == "/INSERT_FOOD") {
      req.on("end", () => {
        let ket_qua = {
          Noi_dung: true,
        };
        let foodNew = JSON.parse(noi_dung_nhan);
        db.insertOne("food", foodNew)
          .then((result) => {
            console.log(result);
            res.end(JSON.stringify(ket_qua));
          })
          .catch((err) => {
            ket_qua.Noi_dung = false;
            console.log(err);
            res.end(JSON.stringify(ket_qua));
          });
      });
    } else if (url == "/INSERT_USER") {
      // Kiểm tra header Authorization
      const authorizationHeader = req.headers.authorization;
      if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
        res.writeHead(401, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Unauthorized" }));
      }

      // Lấy token từ header Authorization
      const token = authorizationHeader.split(" ")[1];

      // Xác thực token JWT
      libToken
        .verifyToken(token)
        .then((decodedToken) => {
          // Nếu xác thực thành công, tiếp tục xử lý yêu cầu
          let ket_qua = { Noi_dung: true };
          req.on("end", () => {
            let userNew = JSON.parse(noi_dung_nhan);
            db.insertOne("user", userNew)
              .then((result) => {
                console.log(result);
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(ket_qua));
              })
              .catch((err) => {
                ket_qua.Noi_dung = false;
                console.log(err);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify(ket_qua));
              });
          });
        })
        .catch((error) => {
          // Xử lý khi token không hợp lệ
          console.error("JWT Verification Error:", error);
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Unauthorized" }));
        });
    } else if (url == "/imgMOBILE") {
      req.on("end", () => {
        let img = JSON.parse(noi_dung_nhan);

        let ket_qua = { Noi_dung: true };

        // upload img in images Hệ Phục vụ
        /*
                let kq = saveMedia(img.name, img.src);
        
                if (kq == "OK") {
                  res.writeHead(200, { "Content-Type": "text/json; charset=utf-8" });
                  res.end(JSON.stringify(ket_qua));
                } else {
                  ket_qua.Noi_dung = false;
                  res.writeHead(200, { "Content-Type": "text/json; charset=utf-8" });
                  res.end(JSON.stringify(ket_qua));
                }
                  */
        // upload img in images cloudinary
        // Function to upload an image to Cloudinary
        imgUpload
          .UPLOAD_CLOUDINARY(img.name, img.src)
          .then((result) => {
            console.log(result); // Log the result of the upload
            res.end(JSON.stringify(ket_qua)); // End the response with the result
          })
          .catch((err) => {
            ket_qua.Noi_dung = false; // Set the content to false in case of an error
            res.end(JSON.stringify(ket_qua)); // End the response with the error result
          });
      });
    } else if (url == "/imgTIVI") {
      req.on("end", () => {
        let img = JSON.parse(noi_dung_nhan);

        let ket_qua = { Noi_dung: true };

        // upload img in images Hệ Phục vụ
        /*
                let kq = saveMedia(img.name, img.src);
        
                if (kq == "OK") {
                  res.writeHead(200, { "Content-Type": "text/json; charset=utf-8" });
                  res.end(JSON.stringify(ket_qua));
                } else {
                  ket_qua.Noi_dung = false;
                  res.writeHead(200, { "Content-Type": "text/json; charset=utf-8" });
                  res.end(JSON.stringify(ket_qua));
                }
                  */
        // upload img in images cloudinary
        // Function to upload an image to Cloudinary
        imgUpload
          .UPLOAD_CLOUDINARY(img.name, img.src)
          .then((result) => {
            console.log(result); // Log the result of the upload
            res.end(JSON.stringify(ket_qua)); // End the response with the result
          })
          .catch((err) => {
            ket_qua.Noi_dung = false; // Set the content to false in case of an error
            res.end(JSON.stringify(ket_qua)); // End the response with the error result
          });
      });
    } else if (url == "/imgFOOD") {
      req.on("end", () => {
        let img = JSON.parse(noi_dung_nhan);

        let ket_qua = { Noi_dung: true };

        // upload img in images Hệ Phục vụ
        /*
                let kq = saveMedia(img.name, img.src);
        
                if (kq == "OK") {
                  res.writeHead(200, { "Content-Type": "text/json; charset=utf-8" });
                  res.end(JSON.stringify(ket_qua));
                } else {
                  ket_qua.Noi_dung = false;
                  res.writeHead(200, { "Content-Type": "text/json; charset=utf-8" });
                  res.end(JSON.stringify(ket_qua));
                }
                  */
        // upload img in images cloudinary
        // Function to upload an image to Cloudinary
        imgUpload
          .UPLOAD_CLOUDINARY(img.name, img.src)
          .then((result) => {
            console.log(result); // Log the result of the upload
            res.end(JSON.stringify(ket_qua)); // End the response with the result
          })
          .catch((err) => {
            ket_qua.Noi_dung = false; // Set the content to false in case of an error
            res.end(JSON.stringify(ket_qua)); // End the response with the error result
          });
      });
    } else if (url == "/imgUSER") {
      req.on("end", () => {
        let img = JSON.parse(noi_dung_nhan);

        let ket_qua = { Noi_dung: true };

        // upload img in images Hệ Phục vụ
        /*
        let kq = saveMedia(img.name, img.src);

        if (kq == "OK") {
          res.writeHead(200, { "Content-Type": "text/json; charset=utf-8" });
          res.end(JSON.stringify(ket_qua));
        } else {
          ket_qua.Noi_dung = false;
          res.writeHead(200, { "Content-Type": "text/json; charset=utf-8" });
          res.end(JSON.stringify(ket_qua));
        }
          */
        // upload img in images cloudinary
        // Function to upload an image to Cloudinary
        imgUpload
          .UPLOAD_CLOUDINARY(img.name, img.src)
          .then((result) => {
            console.log(result); // Log the result of the upload
            res.end(JSON.stringify(ket_qua)); // End the response with the result
          })
          .catch((err) => {
            ket_qua.Noi_dung = false; // Set the content to false in case of an error
            res.end(JSON.stringify(ket_qua)); // End the response with the error result
          });
      });
    } else {
      res.end(kq);
    }
  } else if (method == "PUT") {
    // Lấy dữ liệu từ client gởi về
    let noi_dung_nhan = ``;
    req.on("data", (data) => {
      noi_dung_nhan += data;
    });
    if (url == "/UPDATE_MOBILE") {
      req.on("end", () => {
        let ket_qua = {
          Noi_dung: true,
        };
        let mobileUpdate = JSON.parse(noi_dung_nhan);
        db.updateOne("mobile", mobileUpdate.condition, mobileUpdate.update)
          .then((result) => {
            console.log(result);
            res.end(JSON.stringify(ket_qua));
          })
          .catch((err) => {
            ket_qua.Noi_dung = false;
            console.log(err);
            res.end(JSON.stringify(ket_qua));
          });
      });
    } else if (url == "/UPDATE_TIVI") {
      req.on("end", () => {
        let ket_qua = {
          Noi_dung: true,
        };
        let tiviUpdate = JSON.parse(noi_dung_nhan);
        db.updateOne("tivi", tiviUpdate.condition, tiviUpdate.update)
          .then((result) => {
            console.log(result);
            res.end(JSON.stringify(ket_qua));
          })
          .catch((err) => {
            ket_qua.Noi_dung = false;
            console.log(err);
            res.end(JSON.stringify(ket_qua));
          });
      });
    } else if (url == "/UPDATE_FOOD") {
      req.on("end", () => {
        let ket_qua = {
          Noi_dung: true,
        };
        let foodUpdate = JSON.parse(noi_dung_nhan);
        db.updateOne("food", foodUpdate.condition, foodUpdate.update)
          .then((result) => {
            console.log(result);
            res.end(JSON.stringify(ket_qua));
          })
          .catch((err) => {
            ket_qua.Noi_dung = false;
            console.log(err);
            res.end(JSON.stringify(ket_qua));
          });
      });
    } else if (url == "/UPDATE_USER") {
      req.on("end", () => {
        let ket_qua = {
          Noi_dung: true,
        };
        let userUpdate = JSON.parse(noi_dung_nhan);
        db.updateOne("user", userUpdate.condition, userUpdate.update)
          .then((result) => {
            console.log(result);
            res.end(JSON.stringify(ket_qua));
          })
          .catch((err) => {
            ket_qua.Noi_dung = false;
            console.log(err);
            res.end(JSON.stringify(ket_qua));
          });
      });
    } else {
      res.end(kq);
    }
  } else if (method == "DELETE") {
    let noi_dung_nhan = ``;
    req.on("data", (data) => {
      noi_dung_nhan += data;
    });
    if (url == "/DELETE_MOBILE") {
      req.on("end", () => {
        let ket_qua = {
          Noi_dung: true,
        };
        let mobileDelete = JSON.parse(noi_dung_nhan);
        db.deleteOne("mobile", mobileDelete)
          .then((result) => {
            console.log(result);
            res.end(JSON.stringify(ket_qua));
          })
          .catch((err) => {
            ket_qua.Noi_dung = false;
            console.log(err);
            res.end(JSON.stringify(ket_qua));
          });
      });
    } else if (url == "/DELETE_TIVI") {
      req.on("end", () => {
        let ket_qua = {
          Noi_dung: true,
        };
        let tiviDelete = JSON.parse(noi_dung_nhan);
        db.deleteOne("tivi", tiviDelete)
          .then((result) => {
            console.log(result);
            res.end(JSON.stringify(ket_qua));
          })
          .catch((err) => {
            ket_qua.Noi_dung = false;
            console.log(err);
            res.end(JSON.stringify(ket_qua));
          });
      });
    } else if (url == "/DELETE_FOOD") {
      req.on("end", () => {
        let ket_qua = {
          Noi_dung: true,
        };
        let foodDelete = JSON.parse(noi_dung_nhan);
        db.deleteOne("food", foodDelete)
          .then((result) => {
            console.log(result);
            res.end(JSON.stringify(ket_qua));
          })
          .catch((err) => {
            ket_qua.Noi_dung = false;
            console.log(err);
            res.end(JSON.stringify(ket_qua));
          });
      });
    } else if (url == "/DELETE_USER") {
      req.on("end", () => {
        let ket_qua = {
          Noi_dung: true,
        };
        let userDelete = JSON.parse(noi_dung_nhan);
        db.deleteOne("user", userDelete)
          .then((result) => {
            console.log(result);
            res.end(JSON.stringify(ket_qua));
          })
          .catch((err) => {
            ket_qua.Noi_dung = false;
            console.log(err);
            res.end(JSON.stringify(ket_qua));
          });
      });
    } else {
      res.end(kq);
    }
  } else {
    res.end(kq);
  }
});

// Tạo một WebSocket server kết hợp với HTTP server
const wss = new WebSocket.Server({ server });

// Lắng nghe sự kiện kết nối từ client
wss.on("connection", (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const role = url.searchParams.get("role");
  const name = url.searchParams.get("name") || role;

  // Gửi lịch sử tin nhắn cho client mới kết nối
  ws.send(JSON.stringify({ type: "history", data: messageHistory }));

  // Lắng nghe tin nhắn từ client
  ws.on("message", (message) => {
    const parsedMessage = JSON.parse(message);
    const msgData = {
      name: parsedMessage.name,
      message: parsedMessage.message,
      timestamp: new Date().toISOString(),
    };
    messageHistory.push(msgData);

    // Chuyển tiếp tin nhắn tới tất cả client
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: "message", data: msgData }));
      }
    });
  });

  // Lắng nghe sự kiện ngắt kết nối
  ws.on("close", () => {
    if (role === "buyer") {
      messageHistory = [];
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify({
              type: "notification",
              data: `${name} đã thoát cuộc trò chuyện.`,
            })
          );
        }
      });
    }
  });
});

server.listen(port, () => {
  console.log(`Service Runing http://localhost:${port}`);
});

// Media
let decodeBase64Image = (dataString) => {
  var matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/),
    response = {};

  if (matches.length !== 3) {
    return new Error("Error ...");
  }

  response.type = matches[1];
  response.data = Buffer.from(matches[2], "base64");

  return response;
};

let saveMedia = (Ten, Chuoi_nhi_phan) => {
  var Kq = "OK";
  try {
    var Nhi_phan = decodeBase64Image(Chuoi_nhi_phan);
    var Duong_dan = "images//" + Ten;
    fs.writeFileSync(Duong_dan, Nhi_phan.data);
  } catch (Loi) {
    Kq = Loi.toString();
  }

  return Kq;
};
