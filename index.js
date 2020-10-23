// .envファイル用
require('dotenv').config();

/* サーバーを初期化 */
const express = require('express');
const app = express();
app.use(express.static(__dirname + "/public"));

const http = require('http').createServer(app);

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

/* Socket.io */
const initializeSocket = require('./initializeSocket.js');
initializeSocket(http);

/* 準備フェーズ **********************/

// socket通信に使う情報を送る
app.get('/entry', (req, res) => {  
  return res.json({room: '1001'});
});

http.listen( process.env.PORT || 3000, () => {
  console.log('listening on *:3000');
});