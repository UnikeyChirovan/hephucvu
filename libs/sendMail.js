const nodemailer = require("nodemailer");

class XL_GOI_THU_DIEN_TU {
  Goi_Thu(_from, _to, _subject, _body) {
    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.USERGMAIL, // User gmail
        pass: process.env.PWDGMAIL, // Key code gmail
      },
    });

    let mailOptions = {
      from: `Shop Cáo <${_from}>`,
      to: _to,
      subject: _subject,
      html: _body,
    };
    // Gọi phương thức sendMail -> trả về dạng promise
    return transporter.sendMail(mailOptions);
  }
}

var Goi_thu = new XL_GOI_THU_DIEN_TU();
module.exports = Goi_thu;
