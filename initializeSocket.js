module.exports = function (http) {
  const io = require('socket.io')(http);
  const gameRoom = io.of('/1001');

  const playerIds = [];
  let players;
  let countPreparePhaseGroupEnd = 0;
  let countDayPhaseDebateEnd = 0;
  let countDayPhaseVotingEnd = 0;
  let countDayPhaseLynchEnd = 0;
  const voting = {};

  // 参加者が決まり、通信を始める
  gameRoom.on('connection', async (socket) => {
    /* 準備フェーズ **********************/
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
        countDayPhaseDebateEnd = 0;
        // 投票集計を初期化
        playerIds.forEach( id => {
          voting[id] = 0;
        });
      }
    });

    socket.on('dayPhaseVotingEnd', async (votedId) => {
      console.log('dayPhaseVotingEnd: ', votedId);
      voting[votedId]++;
      countDayPhaseVotingEnd++;
      if (countDayPhaseVotingEnd === 5) {      
        const person = await decideLynchPerson(voting);
        gameRoom.emit('dayPhaseLynch', person, voting);
        countDayPhaseVotingEnd = 0;
      }
    });

    /* 夜フェーズ **********************/
    socket.on('dayPhaseLynchEnd', () => {
      console.log('dayPhaseLynchEnd');
      countDayPhaseLynchEnd++;
      if (countDayPhaseLynchEnd === 5) {
        gameRoom.emit('nightPhasePickTarget', players);
        countDayPhaseLynchEnd = 0;
      }
    });

    socket.on('nightPhasePickTargetEnd', () => {
      console.log('nightPhasePickTargetEnd');
    });
    /* 結果フェーズ **********************/
    
  });

  function decideLynchPerson (voting) {
    return new Promise ( (resolve, reject) => {
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
        resolve(id);
      }
      resolve('nolynch');
    });
  }
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

}