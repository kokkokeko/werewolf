/* サーバーを初期化 */
const express = require('express');
const app = express();
app.use(express.static(__dirname + "/public"));

const http = require('http').createServer(app);

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

/* Socket.io */
const io = require('socket.io')(http);
const gameRoom = io.of('/1001');

/* 準備フェーズ **********************/
const playerIds = [];
let players;

// ゲームに参加するクライアントを決める
app.get('/entry', (req, res) => {  
  // 五人以上いる場合  
  if (playerIds.length >= 5) {
    return res.json({entryResult: 'denied'});
  }  
  // 五人以下の場合
  return res.json({entryResult: 'accepted', room: '1001'});
});

// 参加者が決まり、通信を始める
gameRoom.on('connection', async (socket) => {
  console.log('someone connected');
  playerIds.push(socket.id);
  // socket.idの例： '/1001#xe_-8ijoihv7DnfgAAAA'

  if (playerIds.length === 5) {
    players = await initializeGame(playerIds);
    // preparePhaseGroupイベントへすすむ
  }
});

function initializeGame(playerIds) {
  return new Promise( (resolve, reject) => {
    // 人狼のidxを決める。
    const werewolf = Math.floor(Math.random() * (4 + 1) );
    // player情報
    const players = {};

    playerIds.forEach( (id, idx) => {
      players[id] = {};

      players[id].group = idx === werewolf
        ? 'werewolf'
        : 'villagers';
      players[id].isDead = false;
    });

    resolve(players);
  });
}

/* 昼フェーズ **********************/

/* 夜フェーズ **********************/

/* 結果フェーズ **********************/


http.listen(3000, () => {
  console.log('listening on *:3000');
});