/* 準備フェーズ **********************/
/* ゲームに参加 */
let entryState = 'no attempt';
// すでに参加した人が一度しか参加ボタンを押せないようにする
document.getElementById('entry').addEventListener('click', entryGame);
function entryGame() {      
  if (entryState !== 'no attempt') return;
  fetch('/entry')
    .then(res => res.json())
    .then(data => {             
      entryState = data.entryResult;
      const entryOutput = document.getElementById('entryResult');

      if (entryState === 'accepted') {
        console.log('entry accepted');            
        entryOutput.innerHTML += ': 参加できました';            
        initializeSocket(data.room);
      } else if (entryState === 'denied') {
        console.log('entry denied');            
        entryOutput.innerHTML += ': 定員オーバー！あとで参加してください';
      }
  });    
}

const gameHistory = document.getElementById('gameHistory');

function createHistory(content) {
  const li = document.createElement('li');
  li.appendChild(document.createTextNode(content));
  gameHistory.appendChild(li);
}

function renderPlayers(players) {      
  createHistory('以下は現在の生存者です');
  const form = document.createElement('form');
  for (let [id, state] of Object.entries(players)) {
    const alive = state.isDead === false ? '存命' : '死亡';
    createHistory(`${id} さん: ${alive}`);
  }
}

function renderNextButton(nextStep) {
  // nextStepは次のイベントを表す
  const button = document.createElement('button');
  button.appendChild(document.createTextNode('次へ進む'));
  button.addEventListener('click', (e) => {
    console.log('renderNextButton: ', nextStep);
    socket.emit(nextStep);
    button.disabled = true;
  });
  const li = document.createElement('li');
  li.appendChild(button);
  gameHistory.appendChild(li);
}

function renderVoting(players) {
  // 説明文
  createHistory('以下は参加者');

  // radio formを作成
  const form = document.createElement('form');
  for (let [id, state] of Object.entries(players)) {
    const radio = document.createElement('input');
    radio.setAttribute('type', 'radio');
    radio.setAttribute('name', 'vote');
    radio.setAttribute('value', id);
    if (socket.id === id || state.isDead === true) {
      radio.disabled = true;
    }
    form.appendChild(radio);

    const label = document.createElement('label');
    label.append(document.createTextNode(id));
    form.appendChild(label);
  }

  if (players[socket.id].isDead === false) {
    // 投票ボタン
    const button = document.createElement('button');
    button.appendChild(document.createTextNode('投票'));

    // 投票をサーバに送る
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      console.log('renderVoting submit');
      console.log(form);
      console.log(new FormData(form));
      const data = new FormData(form);
      for (const entry of data) {
        socket.emit('dayPhaseVotingEnd', entry[1]);
      }
      button.disabled = true;
    });

    form.appendChild(button);
  }

  // gameHistoryに追加
  const li = document.createElement('li');
  li.appendChild(form);
  gameHistory.appendChild(li);
}

function renderVotingResult(voting, id) {
  createHistory('結果は以下の通りです');
  for (let [id, count] of Object.entries(voting)) {
    createHistory(`${id} さんは${count}票`);
  }
  if (id === 'nolynch') {
    // 処刑されなかった
    createHistory('同数票がいるため処刑は行われませんでした');
  } else {
    // ooが処刑された
    createHistory('投票の結果、'+id+' さんが処刑されました');
  }
}

function renderTarget(players) {
  // 説明文
  createHistory('人狼は殺害する人を選んでください。');

  // radio formを作成
  const form = document.createElement('form');
  for (let [id, state] of Object.entries(players)) {
    const radio = document.createElement('input');
    radio.setAttribute('type', 'radio');
    radio.setAttribute('name', 'vote');
    radio.setAttribute('value', id);
    if (socket.id === id || state.isDead === true) {
      radio.disabled = true;
    }
    form.appendChild(radio);

    const label = document.createElement('label');
    label.append(document.createTextNode(id));
    form.appendChild(label);
  }

  if (players[socket.id].group === 'werewolf') {
    createHistory('あなたは人狼なので殺害する人を選んでください。');
    // 殺害ボタン
    const button = document.createElement('button');
    button.appendChild(document.createTextNode('殺害'));
    // 殺害者をサーバに送る
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      console.log('renderTarget submit');
      const data = new FormData(form);
      for (const entry of data) {
        socket.emit('nightPhasePickTargetEnd', entry[1]);
      }
      button.disabled = true;
    });
    form.appendChild(button);
  }

  // gameHistoryに追加
  const li = document.createElement('li');
  li.appendChild(form);
  gameHistory.appendChild(li);

  if (players[socket.id].group === 'villagers') {
    createHistory('あなたは村人なので朝になるまでお待ちください');
  }
}

function renderKillResult (id) {
  createHistory(id+' さんが殺害されました。');
}

let socket;
function initializeSocket(gameRoom) {
  socket = io('/'+gameRoom); 

  socket.on('preparePhaseGroup', (group, players) => {
    // あなたのグループはooです
    const content = 'あなたの役職は'+group+'です';
    createHistory(content);
    renderPlayers(players);
    if (players[socket.id].isDead === false) {
      renderNextButton('preparePhaseGroupEnd');
    }
  });

  /* 昼フェーズ **********************/
  socket.on('dayPhaseDebate', (players) => {
    // 話し合う
    createHistory('話し合ってください');
    if (players[socket.id].isDead === false) {
      renderNextButton('dayPhaseDebateEnd');
    }
  });
  socket.on('dayPhaseVoting', (players) => {
    // 処刑する人を選択
    console.log('dayPhaseVoting');
    createHistory('処刑する人を選んでください');
    renderVoting(players);
  });
  socket.on('dayPhaseLynch', (id, voting, players) => {
    // 処刑結果
    console.log('dayPhaseLynch');
    console.log('voting result', voting);
    console.log('id: ', id);
    renderVotingResult(voting, id);
    renderPlayers(players);
    if (players[socket.id].isDead === false) {
      renderNextButton('dayPhaseLynchEnd');
    }
  });

  /* 夜フェーズ **********************/
  socket.on('nightPhasePickTarget', (players) => {
    // 殺害する人を選んでください
    console.log('nightPhasePickTarget');
    renderTarget(players);
  });
  socket.on('dayPhaseKill', (killed, players) => {
    // ooが殺害されました
    console.log('dayPhaseKill');
    renderKillResult(killed);
    renderPlayers(players);
    if (players[socket.id].isDead === false) {
      renderNextButton('dayPhaseKillEnd');
    }
  });

  /* 結果フェーズ **********************/
  socket.on('resultPhase', () => {
    // 残りoo人になりました
    // ooの勝利
  });
}