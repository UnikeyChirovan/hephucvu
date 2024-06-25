require("dotenv").config();
const express = require("express");
const fs = require("fs");
const http = require("http");
const WebSocket = require("ws");
const port = process.env.PORT;
const db = require("./libs/mongoDB");
const sendMail = require("./libs/sendMail");
const imgUpload = require("./libs/cloudinaryImages");
const libToken = require("./libs/libsToken");
const to_vietnamese = require("./libs/numberToWords");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());
const server = http.createServer(app);

// Phục vụ file tĩnh từ thư mục frontend/buyer
app.use("/buyer", express.static("frontend/buyer"));

// Phục vụ file tĩnh từ thư mục frontend/seller
app.use("/seller", express.static("frontend/seller"));
// Lưu trữ lịch sử tin nhắn
let messageHistory = [];

// Cấp quyền
app.use((req, res, next) => {
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
  next();
});

app.get("/:collectionName", (req, res) => {
  let collectionName = db.collectionNames[req.params.collectionName];
  if (collectionName) {
    db.getAll(collectionName)
      .then((result) => res.json(result))
      .catch((err) => res.json(err));
  } else {
    res.status(404).send(`Collection ${req.params.collectionName} not found`);
  }
});

app.get("*.png", (req, res) => {
  let imagePath = `images${req.url}`;
  if (!fs.existsSync(imagePath)) {
    imagePath = `images/noImage.png`;
  }
  res.sendFile(imagePath, { root: __dirname });
});

app.post("/DATHANG", (req, res) => {
  let dsDathang = req.body;
  let ket_qua = { Noi_dung: [] };
  let tongTien = 0; // Khởi tạo biến tổng tiền

  dsDathang.forEach((item) => {
    let filter = { Ma_so: item.key };
    let collectionName =
      item.nhom == 1 ? "tivi" : item.nhom == 2 ? "mobile" : "food";
    db.getOne(collectionName, filter)
      .then((result) => {
        item.dathang.So_Phieu_Dat = result.Danh_sach_Phieu_Dat.length + 1;
        result.Danh_sach_Phieu_Dat.push(item.dathang);
        let capnhat = {
          $set: { Danh_sach_Phieu_Dat: result.Danh_sach_Phieu_Dat },
        };
        let obj = { Ma_so: result.Ma_so, Update: true };
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
                  return sendMail.Goi_Thu(_from, _toBan, _subjectBan, htmlBan);
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

app.post("/LIENHE", (req, res) => {
  let thongTin = req.body;
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

app.post("/LOGIN", (req, res) => {
  let user = req.body;
  let ket_qua = { Noi_dung: true };
  let dieukien = {
    $and: [{ Ten_Dang_nhap: user.Ten_Dang_nhap }, { Mat_khau: user.Mat_khau }],
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
            res.json(ket_qua);
          })
          .catch((err) => {
            console.log(err);
            ket_qua.Noi_dung = false;
            res.json(ket_qua);
          });
      } else {
        ket_qua.Noi_dung = false;
        res.json(ket_qua);
      }
    })
    .catch((err) => {
      console.log(err);
      ket_qua.Noi_dung = false;
      res.json(ket_qua);
    });
});
app.post("/INSERT_MOBILE", (req, res) => {
  const authorizationHeader = req.headers.authorization;
  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Lấy token từ header Authorization
  const token = authorizationHeader.split(" ")[1];

  // Xác thực token JWT
  libToken
    .verifyToken(token)
    .then((decodedToken) => {
      // Nếu xác thực thành công, tiếp tục xử lý yêu cầu
      const mobileNew = req.body; // Dữ liệu từ client đã có sẵn trong req.body
      db.insertOne("mobile", mobileNew)
        .then((result) => {
          console.log(result);
          res.status(200).json({ Noi_dung: true });
        })
        .catch((err) => {
          console.error(err);
          res.status(500).json({ Noi_dung: false });
        });
    })
    .catch((error) => {
      // Xử lý khi token không hợp lệ
      console.error("JWT Verification Error:", error);
      res.status(401).json({ error: "Unauthorized" });
    });
});
app.post("/INSERT_TIVI", (req, res) => {
  let tiviNew = req.body;
  let ket_qua = { Noi_dung: true };

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

app.post("/INSERT_FOOD", (req, res) => {
  let foodNew = req.body;
  let ket_qua = { Noi_dung: true };

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

app.post("/INSERT_USER", (req, res) => {
  const authorizationHeader = req.headers.authorization;
  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
    res.writeHead(401, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Unauthorized" }));
  }

  const token = authorizationHeader.split(" ")[1];

  libToken
    .verifyToken(token)
    .then((decodedToken) => {
      let userNew = req.body;
      let ket_qua = { Noi_dung: true };

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
    })
    .catch((error) => {
      console.error("JWT Verification Error:", error);
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
    });
});

app.post("/imgMOBILE", (req, res) => {
  let img = req.body;
  let ket_qua = { Noi_dung: true };

  imgUpload
    .UPLOAD_CLOUDINARY(img.name, img.src)
    .then((result) => {
      console.log(result);
      res.end(JSON.stringify(ket_qua));
    })
    .catch((err) => {
      ket_qua.Noi_dung = false;
      res.end(JSON.stringify(ket_qua));
    });
});

app.post("/imgTIVI", (req, res) => {
  let img = req.body;
  let ket_qua = { Noi_dung: true };

  imgUpload
    .UPLOAD_CLOUDINARY(img.name, img.src)
    .then((result) => {
      console.log(result);
      res.end(JSON.stringify(ket_qua));
    })
    .catch((err) => {
      ket_qua.Noi_dung = false;
      res.end(JSON.stringify(ket_qua));
    });
});

app.post("/imgFOOD", (req, res) => {
  let img = req.body;
  let ket_qua = { Noi_dung: true };

  imgUpload
    .UPLOAD_CLOUDINARY(img.name, img.src)
    .then((result) => {
      console.log(result);
      res.end(JSON.stringify(ket_qua));
    })
    .catch((err) => {
      ket_qua.Noi_dung = false;
      res.end(JSON.stringify(ket_qua));
    });
});

app.post("/imgUSER", (req, res) => {
  let img = req.body;
  let ket_qua = { Noi_dung: true };

  imgUpload
    .UPLOAD_CLOUDINARY(img.name, img.src)
    .then((result) => {
      console.log(result);
      res.end(JSON.stringify(ket_qua));
    })
    .catch((err) => {
      ket_qua.Noi_dung = false;
      res.end(JSON.stringify(ket_qua));
    });
});

app.put("/UPDATE_MOBILE", (req, res) => {
  let mobileUpdate = req.body;
  let ket_qua = { Noi_dung: true };

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

app.put("/UPDATE_TIVI", (req, res) => {
  let tiviUpdate = req.body;
  let ket_qua = { Noi_dung: true };

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

app.put("/UPDATE_FOOD", (req, res) => {
  let foodUpdate = req.body;
  let ket_qua = { Noi_dung: true };

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

app.put("/UPDATE_USER", (req, res) => {
  let userUpdate = req.body;
  let ket_qua = { Noi_dung: true };

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

app.delete("/DELETE_MOBILE", (req, res) => {
  let mobileDelete = req.body;
  let ket_qua = { Noi_dung: true };

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

app.delete("/DELETE_TIVI", (req, res) => {
  let tiviDelete = req.body;
  let ket_qua = { Noi_dung: true };

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

app.delete("/DELETE_FOOD", (req, res) => {
  let foodDelete = req.body;
  let ket_qua = { Noi_dung: true };

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

app.delete("/DELETE_USER", (req, res) => {
  let userDelete = req.body;
  let ket_qua = { Noi_dung: true };

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
// Tạo một WebSocket server kết hợp với HTTP server
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const role = url.searchParams.get("role");
  const name = url.searchParams.get("name") || role;

  ws.send(JSON.stringify({ type: "history", data: messageHistory }));

  ws.on("message", (message) => {
    const parsedMessage = JSON.parse(message);
    const msgData = {
      name: parsedMessage.name,
      message: parsedMessage.message,
      timestamp: new Date().toISOString(),
    };
    messageHistory.push(msgData);

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: "message", data: msgData }));
      }
    });
  });

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
  console.log(`Service Running http://localhost:${port}`);
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
