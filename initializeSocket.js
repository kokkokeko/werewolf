module.exports = function (http) {
  const io = require('socket.io')(http);
  const gameRoom = io.of('/1001');

  const playerNames = [];
  let players;
  let countPreparePhaseGroupEnd = 0;
  let countDayPhaseDebateEnd = 0;
  let countDayPhaseVotingEnd = 0;
  let countDayPhaseLynchEnd = 0;
  let countDayPhaseKillEnd = 0;
  let totalAlive = 5;
  const voting = {};
  let werewolfId;

  // 参加者が決まり、通信を始める
  gameRoom.on('connection', async (socket) => {
    /* 準備フェーズ **********************/
    console.log('someone connected');

    socket.on('disconnect', () => {
      // 誰かが退出するとゲームを終了する
      gameRoom.emit('someoneDisconnect');
    });

    socket.on('submitPlayerName', async (name) => {
      console.log('submitPlayerName');
      playerNames.push([socket.id, name]);
      // socket.idの例： '/1001#xe_-8ijoihv7DnfgAAAA'

      if (playerNames.length === 5) {
        players = await initializeGame(playerNames);
        // preparePhaseGroupイベントへすすむ
        for (let [id, state] of Object.entries(players)) {
          const group = state.group;
          gameRoom.to(id).emit('preparePhaseGroup', group, players);
        }        
      }
    });

    /* 昼フェーズ **********************/
    socket.on('preparePhaseGroupEnd', () => {
      // 昼フェーズをスタートする
      console.log('preparePhaseGroupEnd');
      countPreparePhaseGroupEnd++;
      if (countPreparePhaseGroupEnd === totalAlive) {
        gameRoom.emit('dayPhaseDebate', players);
        countPreparePhaseGroupEnd = 0;
      }
    });

    socket.on('dayPhaseDebateEnd', () => {
      console.log('dayPhaseDebateEnd');
      countDayPhaseDebateEnd++;
      if (countDayPhaseDebateEnd === totalAlive) {
        gameRoom.emit('dayPhaseVoting', players);
        countDayPhaseDebateEnd = 0;
        // 投票集計を初期化
        playerNames.forEach( ([id, name]) => {
          voting[id] = 0;
        });
      }
    });

    socket.on('dayPhaseVotingEnd', async (votedId) => {
      console.log('dayPhaseVotingEnd: ', votedId);
      if (votedId !== 'noselect') {
        voting[votedId]++;
      }
      countDayPhaseVotingEnd++;
      if (countDayPhaseVotingEnd === totalAlive) {
        const person = await decideLynchPerson(voting);
        if (person !== 'nolynch') {
          totalAlive--;
        }
        let winner = 'no terminate';
        if (players[werewolfId].isDead === true) {
          winner = 'villagers';
        } else if (totalAlive === 2) {
          winner = 'werewolf';
        }

        gameRoom.emit('dayPhaseLynch', person, voting, players, winner);
        countDayPhaseVotingEnd = 0;
      }
    });

    /* 夜フェーズ **********************/
    socket.on('dayPhaseLynchEnd', () => {
      console.log('dayPhaseLynchEnd');
      countDayPhaseLynchEnd++;
      if (countDayPhaseLynchEnd === totalAlive) {
        gameRoom.emit('nightPhasePickTarget', players);
        countDayPhaseLynchEnd = 0;
      }
    });

    socket.on('nightPhasePickTargetEnd', (killId) => {
      console.log('nightPhasePickTargetEnd');
      players[killId].isDead = true;
      totalAlive--;
      let winner = 'no terminate';
      if (totalAlive === 2) {
        winner = 'werewolf';
      }
      gameRoom.emit('dayPhaseKill', killId, players, winner);
    });

    socket.on('dayPhaseKillEnd', () => {
      console.log('dayPhaseKillEnd');
      countDayPhaseKillEnd++
      if (countDayPhaseKillEnd === totalAlive) {
        gameRoom.emit('dayPhaseDebate', players);
        countDayPhaseKillEnd = 0;
      }
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
  function initializeGame(playerNames) {
    return new Promise( (resolve, reject) => {
      // 人狼のidxを決める。
      const werewolf = Math.floor(Math.random() * (4 + 1) );
      // player情報
      const players = {};

      playerNames.forEach( ([id, name], idx) => {
        players[id] = {};

        if (idx === werewolf) {
          players[id].group = 'werewolf';
          werewolfId = id;
        } else {
          players[id].group = 'villagers';
        }
        players[id].name = name;
        players[id].isDead = false;
      });

      resolve(players);
    });
  }

}