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
let playerCount = 0;

// ゲームに参加するクライアントを決める
app.get('/entry', (req, res) => {  
  playerCount++;
  // 五人以上いる場合  
  if (playerCount > 5) {
    return res.json({entryResult: 'denied'});
  }  
  // 五人以下の場合
  return res.json({entryResult: 'accepted', room: '1001'});
});

http.listen(3000, () => {
  console.log('listening on *:3000');
});