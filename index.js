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

let countPreparePhaseGroupEnd = 0;
let countDayPhaseDebateEnd = 0;
let countDayPhaseVotingEnd = 0;
const voting = {};

// 参加者が決まり、通信を始める
gameRoom.on('connection', async (socket) => {
  console.log('someone connected');

  playerIds.push(socket.id);
  // socket.idの例： '/1001#xe_-8ijoihv7DnfgAAAA'

  if (playerIds.length === 5) {
    players = await initializeGame(playerIds);
    // preparePhaseGroupイベントへすすむ
    for (let [id, state] of Object.entries(players)) {
      const group = state.group;
      gameRoom.to(id).emit('preparePhaseGroup', group, players);
    }
  }

  /* 昼フェーズ **********************/
  socket.on('preparePhaseGroupEnd', () => {
    // 昼フェーズをスタートする
    console.log('preparePhaseGroupEnd');
    countPreparePhaseGroupEnd++;
    if (countPreparePhaseGroupEnd === 5) {
      gameRoom.emit('dayPhaseDebate');
      countPreparePhaseGroupEnd = 0;
    }
  });

  socket.on('dayPhaseDebateEnd', () => {
    console.log('dayPhaseDebateEnd');
    countDayPhaseDebateEnd++;
    if (countDayPhaseDebateEnd === 5) {
      gameRoom.emit('dayPhaseVoting', players);
      // 投票集計を初期化
      playerIds.forEach( id => {
        voting[id] = 0;
      });
    }
  });

  socket.on('dayPhaseVotingEnd', (votedId) => {
    console.log('dayPhaseVotingEnd: ', votedId);
    voting[votedId]++;
    countDayPhaseVotingEnd++;
    if (countDayPhaseVotingEnd === 5) {      
      // 集計結果をとる
      let maxVote = -1;
      let lynch = [];
      for (let [id, votesCast] of Object.entries(voting)) {
        if (maxVote < votesCast) {
          maxVote = votesCast;
          lynch = [id];
        } else if (maxVote === votesCast) {
          lynch.push(id);
        }
      }
      
      if (lynch.length === 1) {
        const id = lynch[0];
        players[id].isDead = true;
        gameRoom.emit('dayPhaseLynch', id, voting);
      } else {
        gameRoom.emit('dayPhaseLynch', 'nolynch', voting);
      }

    }
  });
  
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




/* 夜フェーズ **********************/

/* 結果フェーズ **********************/


http.listen(3000, () => {
  console.log('listening on *:3000');
});