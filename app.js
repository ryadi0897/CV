import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js';
import {
  getDatabase,
  ref,
  onValue,
  get,
  set,
  update,
  remove,
  child
} from 'https://www.gstatic.com/firebasejs/12.14.0/firebase-database.js';

const firebaseConfig = {
  apiKey: 'AIzaSyC7sAGOJbFi7R-W6R0WqyRGVGJL6fe9sbc',
  authDomain: 'my-mafia.firebaseapp.com',
  databaseURL: 'https://my-mafia-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'my-mafia',
  storageBucket: 'my-mafia.firebasestorage.app',
  messagingSenderId: '167885019684',
  appId: '1:167885019684:web:678478e9737e5418c196b1',
  measurementId: 'G-9TL1D1Y0NZ'
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const screens = {
  welcome: document.getElementById('welcome-screen'),
  lobby: document.getElementById('lobby-screen'),
  configRoles: document.getElementById('config-roles-screen'),
  role: document.getElementById('role-screen'),
  night: document.getElementById('night-screen'),
  day: document.getElementById('day-screen'),
  vote: document.getElementById('vote-screen'),
  result: document.getElementById('result-screen'),
  over: document.getElementById('game-over-screen')
};

const controls = {
  createRoom: document.getElementById('create-room-btn'),
  joinRoom: document.getElementById('join-room-btn'),
  joinName: document.getElementById('join-name'),
  joinCode: document.getElementById('join-code'),
  roomCodeDisplay: document.getElementById('room-code-display'),
  roomStatus: document.getElementById('room-status-pill'),
  playersList: document.getElementById('players-list'),
  startGame: document.getElementById('start-game-btn'),
  leaveRoom: document.getElementById('leave-room-btn'),
  mafiaCount: document.getElementById('mafia-count'),
  rolesCheckboxes: document.querySelectorAll('.roles-checkboxes input[type="checkbox"]'),
  citizenCount: document.getElementById('citizen-count'),
  confirmRoles: document.getElementById('confirm-roles-btn'),
  roleDisplay: document.getElementById('role-display'),
  roleDescription: document.getElementById('role-description'),
  continueToNight: document.getElementById('continue-to-night'),
  nightInstruction: document.getElementById('night-instruction'),
  nightActionArea: document.getElementById('night-action-area'),
  nightWait: document.getElementById('night-wait-btn'),
  dayAnnouncement: document.getElementById('day-announcement'),
  dayCount: document.getElementById('day-count'),
  startVote: document.getElementById('start-vote-btn'),
  voteList: document.getElementById('vote-list'),
  voteSubmit: document.getElementById('vote-submit-btn'),
  resultMessage: document.getElementById('result-message'),
  continueAfterResult: document.getElementById('continue-after-result'),
  gameOverMessage: document.getElementById('game-over-message'),
  finalDetails: document.getElementById('final-details')
};

const template = document.getElementById('player-badge-template');

const state = {
  roomCode: null,
  playerId: localStorage.getItem('mafia-player-id') || generateId(),
  playerName: null,
  roomRef: null,
  roomUnsubscribe: null,
  snapshot: null,
  currentRole: null,
  isHost: false,
  hasVoted: false,
  hasNightAction: false,
  roleConfig: {
    mafiaCount: 1,
    selectedRoles: ['doctor', 'detective']
  },
  quobidoLinks: {}
};

localStorage.setItem('mafia-player-id', state.playerId);

controls.createRoom.addEventListener('click', createRoom);
controls.joinRoom.addEventListener('click', joinRoom);
controls.startGame.addEventListener('click', openRoleConfig);
controls.leaveRoom.addEventListener('click', leaveRoom);
controls.confirmRoles.addEventListener('click', confirmRoleConfig);
controls.continueToNight.addEventListener('click', () => showScreen('night'));
controls.nightWait.addEventListener('click', () => alert('Attendez que la phase de nuit se termine.'));
controls.startVote.addEventListener('click', () => setRoomPhase('vote'));
controls.voteSubmit.addEventListener('click', submitVote);
controls.continueAfterResult.addEventListener('click', goToNextPhase);
controls.mafiaCount.addEventListener('change', updateCitizenCount);
controls.rolesCheckboxes.forEach(checkbox => {
  checkbox.addEventListener('change', updateCitizenCount);
});
controls.restartBtn = document.getElementById('restart-btn');
if (controls.restartBtn) {
  controls.restartBtn.addEventListener('click', resetToWelcome);
}

function generateId() {
  return 'p-' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

function showScreen(key) {
  Object.values(screens).forEach(screen => screen.classList.remove('active'));
  screens[key].classList.add('active');
}

function setRoomPhase(phase) {
  if (!state.roomRef) return;
  const updatesData = { phase };
  if (phase === 'vote') {
    updatesData.votes = null;
  }
  update(state.roomRef, updatesData).catch(err => console.error('Erreur phase :', err));
}

function createRoom() {
  const name = prompt('Pseudo du host ?');
  if (!name || !name.trim()) return alert('Saisissez un pseudo valide.');

  state.playerName = name.trim();
  const code = generateRoomCode();
  state.roomCode = code;
  state.roomRef = ref(database, `rooms/${code}`);
  state.isHost = true;

  const roomData = {
    code,
    hostId: state.playerId,
    phase: 'waiting',
    dayCount: 0,
    createdAt: Date.now(),
    players: {
      [state.playerId]: {
        name: state.playerName,
        alive: true,
        role: 'attente',
        joinedAt: Date.now()
      }
    }
  };

  set(state.roomRef, roomData)
    .then(() => {
      attachRoomListeners(code);
      showScreen('lobby');
    })
    .catch(err => {
      console.error('Erreur création salle :', err);
      alert('Impossible de créer la salle : ' + err.message);
    });
}

function joinRoom() {
  const name = controls.joinName.value.trim();
  const code = controls.joinCode.value.trim().toUpperCase();
  if (!name || !code) return alert('Pseudo et code de salle sont requis.');

  state.playerName = name;
  state.roomCode = code;
  state.roomRef = ref(database, `rooms/${code}`);

  get(state.roomRef).then(snapshot => {
    if (!snapshot.exists()) {
      return alert('Salle introuvable. Vérifiez le code.');
    }
    const phase = snapshot.child('phase').val();
    if (phase !== 'waiting') {
      return alert('La partie a déjà commencé.');
    }

    set(ref(database, `rooms/${code}/players/${state.playerId}`), {
      name: state.playerName,
      alive: true,
      role: 'attente',
      joinedAt: Date.now()
    }).then(() => {
      attachRoomListeners(code);
      showScreen('lobby');
    });
  });
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function attachRoomListeners(code) {
  state.roomCode = code;
  state.roomRef = ref(database, `rooms/${code}`);
  controls.roomCodeDisplay.textContent = code;

  if (state.roomUnsubscribe) {
    state.roomUnsubscribe();
  }

  state.roomUnsubscribe = onValue(state.roomRef, snapshot => {
    if (!snapshot.exists()) {
      alert('La salle a été fermée ou n’existe plus.');
      resetToWelcome();
      return;
    }

    state.snapshot = snapshot.val();
    state.isHost = state.snapshot.hostId === state.playerId;
    renderRoom();
  });
}

function renderRoom() {
  const room = state.snapshot;
  const players = room.players ? Object.entries(room.players).map(([id, payload]) => ({ id, ...payload })) : [];
  const alivePlayers = players.filter(p => p.alive);

  controls.roomStatus.textContent = room.phase === 'waiting' ? 'En attente' : room.phase === 'night' ? 'Nuit' : room.phase === 'day' ? 'Jour' : room.phase === 'vote' ? 'Vote' : room.phase === 'ended' ? 'Terminé' : 'En cours';
  controls.playersList.innerHTML = '';

  players.sort((a, b) => b.alive - a.alive || a.joinedAt - b.joinedAt).forEach(player => {
    const badge = template.content.cloneNode(true);
    badge.querySelector('.player-name').textContent = player.name + (player.id === state.playerId ? ' (Vous)' : '');
    badge.querySelector('.player-status').textContent = player.alive ? 'Vivant' : 'Éliminé';
    controls.playersList.appendChild(badge);
  });

  if (room.phase === 'waiting') {
    renderLobby(room, players);
  } else if (room.phase === 'night') {
    renderNight(room, players);
  } else if (room.phase === 'day') {
    renderDay(room, alivePlayers);
  } else if (room.phase === 'vote') {
    renderVote(room, alivePlayers);
  } else if (room.phase === 'result') {
    renderResult(room);
  } else if (room.phase === 'ended') {
    renderGameOver(room, players);
  }
}

function renderLobby(room, players) {
  if (state.snapshot.phase !== 'waiting') return;
  controls.lobbyInstruction.textContent = 'Attendez que tous les joueurs soient prêts. Le host peut démarrer la partie.';
  controls.startGame.style.display = state.isHost ? 'block' : 'none';
  controls.leaveRoom.style.display = 'block';
  showScreen('lobby');
}

function openRoleConfig() {
  if (!state.isHost) return;
  const room = state.snapshot;
  const players = room.players ? Object.entries(room.players) : [];
  if (players.length < 4) return alert('Il faut au moins 4 joueurs pour commencer.');
  showScreen('configRoles');
  updateCitizenCount();
}

function updateCitizenCount() {
  const mafiaCount = parseInt(controls.mafiaCount.value) || 1;
  const selectedCount = Array.from(controls.rolesCheckboxes).filter(cb => cb.checked).length;
  const totalPlayers = state.snapshot.players ? Object.keys(state.snapshot.players).length : 0;
  const citizenCount = Math.max(0, totalPlayers - mafiaCount - selectedCount);
  controls.citizenCount.textContent = citizenCount;
}

function confirmRoleConfig() {
  const room = state.snapshot;
  const players = room.players ? Object.entries(room.players) : [];
  const mafiaCount = parseInt(controls.mafiaCount.value) || 1;
  const selectedRoles = Array.from(controls.rolesCheckboxes).filter(cb => cb.checked).map(cb => cb.value);

  const roles = [];
  for (let i = 0; i < mafiaCount; i++) {
    roles.push('mafia');
  }
  selectedRoles.forEach(role => roles.push(role));
  const totalPlayers = players.length;
  const citizenCount = Math.max(0, totalPlayers - roles.length);
  for (let i = 0; i < citizenCount; i++) {
    roles.push('citizen');
  }

  startGameWithRoles(roles);
}

function startGameWithRoles(roles) {
  const room = state.snapshot;
  const players = room.players ? Object.entries(room.players) : [];
  if (players.length < 4) return alert('Il faut au moins 4 joueurs pour commencer.');

  const shuffledRoles = shuffle(roles);
  const updates = {};
  const quobidoLinks = {};

  players.sort(([, a], [, b]) => a.joinedAt - b.joinedAt);
  players.forEach(([id, data], index) => {
    updates[`rooms/${state.roomCode}/players/${id}/role`] = shuffledRoles[index];
    updates[`rooms/${state.roomCode}/players/${id}/alive`] = true;
  });

  shuffledRoles.forEach((role, index) => {
    if (role === 'quobido' && index + 1 < shuffledRoles.length) {
      const quobidoId = players[index][0];
      const linkedId = players[index + 1][0];
      quobidoLinks[quobidoId] = linkedId;
    }
  });

  updates[`rooms/${state.roomCode}/phase`] = 'night';
  updates[`rooms/${state.roomCode}/dayCount`] = 1;
  updates[`rooms/${state.roomCode}/nightActions`] = null;
  updates[`rooms/${state.roomCode}/lastDeath`] = null;
  updates[`rooms/${state.roomCode}/resultMessage`] = null;
  updates[`rooms/${state.roomCode}/voteResults`] = null;
  updates[`rooms/${state.roomCode}/quobidoLinks`] = Object.keys(quobidoLinks).length > 0 ? quobidoLinks : null;

  update(ref(database, '/'), updates).catch(err => alert('Impossible de lancer la partie : ' + err.message));
}

function shuffle(array) {
  return array.slice().sort(() => Math.random() - 0.5);
}

function renderNight(room, players) {
  const me = room.players?.[state.playerId];
  if (!me) return resetToWelcome();

  state.currentRole = me.role;
  controls.roleDisplay.textContent = formatRole(me.role);
  controls.roleDescription.textContent = getRoleDescription(me.role);

  if (room.phase === 'night' && room.nightActions?.processed) {
    return showScreen('day');
  }

  if (me.role === 'mafia' || me.role === 'doctor' || me.role === 'detective' || me.role === 'quobido') {
    renderNightAction(roleActionForm(me.role, room, players, room.quobidoLinks));
  } else {
    controls.nightInstruction.textContent = 'Vous dormez pendant la nuit. Attendez le résultat.';
    controls.nightActionArea.innerHTML = '<div class="note">Écran noir, vous ne pouvez rien faire ce tour-ci.</div>';
    showScreen('night');
  }
}

function renderNightAction(formHtml) {
  controls.nightActionArea.innerHTML = formHtml;
  showScreen('night');
  Array.from(controls.nightActionArea.querySelectorAll('button')).forEach(btn => {
    btn.addEventListener('click', handleNightSelection);
  });
}

function roleActionForm(role, room, players, quobidoLinks) {
  const alive = Object.entries(room.players).filter(([, p]) => p.alive);
  const me = room.players[state.playerId];

  if (role === 'mafia') {
    const targets = alive.filter(([id, player]) => id !== state.playerId && player.role !== 'mafia');
    return buildOptionForm('Choisissez une victime', targets, 'mafiaTarget');
  }
  if (role === 'doctor') {
    const targets = alive;
    return buildOptionForm('Choisissez qui protéger', targets, 'doctorProtect');
  }
  if (role === 'detective') {
    const targets = alive.filter(([id]) => id !== state.playerId);
    return buildOptionForm('Choisissez qui enquêter', targets, 'detectiveTarget');
  }
  if (role === 'quobido') {
    const targets = alive.filter(([id]) => id !== state.playerId);
    return buildOptionForm('Choisissez qui lier avec vous (si vous mourez, il/elle meurt aussi)', targets, 'quobidoLink');
  }
  return '<div>Vous n’avez pas d’action cette nuit.</div>';
}

function buildOptionForm(label, targets, actionKey) {
  const list = targets.map(([id, player]) => `<button class="secondary-btn" data-action="${actionKey}" data-target="${id}">${player.name}</button>`).join('');
  return `<p>${label}</p><div class="players-list">${list}</div>`;
}

function handleNightSelection(event) {
  const button = event.currentTarget;
  const action = button.dataset.action;
  const targetId = button.dataset.target;
  if (!action || !targetId) return;

  const updates = {};
  updates[`rooms/${state.roomCode}/nightActions/${action}`] = targetId;
  update(ref(database, '/'), updates).then(() => {
    controls.nightActionArea.innerHTML = '<p class="note">Action enregistrée. Attendez la fin de la nuit.</p>';
    if (state.isHost) {
      setTimeout(() => evaluateNight(), 1200);
    }
  });
}

function evaluateNight() {
  get(state.roomRef).then(snapshot => {
    const room = snapshot.val();
    if (!room || room.phase !== 'night') return;
    const actions = room.nightActions || {};
    if (!actions.mafiaTarget || !actions.doctorProtect || !actions.detectiveTarget) return;
    if (actions.processed) return;

    const players = room.players || {};
    const quobidoLinks = room.quobidoLinks || {};
    let deathTarget = actions.mafiaTarget;
    const protectedTarget = actions.doctorProtect;
    const isSaved = deathTarget === protectedTarget;
    let killed = isSaved ? null : deathTarget;

    if (killed && players[killed]) {
      players[killed].alive = false;
      if (quobidoLinks[killed]) {
        players[quobidoLinks[killed]].alive = false;
      }
    }

    const detectiveTarget = actions.detectiveTarget;
    const detectiveResult = players[detectiveTarget] ? players[detectiveTarget].role : null;
    const dayMessage = killed
      ? `La nuit a été sanglante : ${players[killed].name} est mort.e.`
      : 'La nuit est passée sans victime grâce au docteur.';

    const updates = {
      [`rooms/${state.roomCode}/players`]: players,
      [`rooms/${state.roomCode}/phase`]: 'day',
      [`rooms/${state.roomCode}/dayCount`]: (room.dayCount || 0) + 1,
      [`rooms/${state.roomCode}/lastDeath`]: killed || null,
      [`rooms/${state.roomCode}/dayMessage`]: dayMessage,
      [`rooms/${state.roomCode}/detectiveResult`]: detectiveResult,
      [`rooms/${state.roomCode}/nightActions/processed`]: true
    };

    update(ref(database, '/'), updates).then(() => {
      checkEndConditions(roomCode => get(ref(database, `rooms/${roomCode}`)));
    });
  });
}

function renderDay(room, alivePlayers) {
  const deathName = room.lastDeath ? (room.players?.[room.lastDeath]?.name || 'Quelqu’un') : null;
  controls.dayAnnouncement.textContent = room.lastDeath
    ? `La ville découvre que ${deathName} n'est plus parmi eux.`
    : 'La ville est en vie ce matin. Le docteur a protégé la cible.';
  controls.dayCount.textContent = `Jour ${room.dayCount || 1}`;
  showScreen('day');
}

function renderVote(room, alivePlayers) {
  const me = room.players?.[state.playerId];
  if (!me || !me.alive) {
    controls.voteInstruction.textContent = 'Vous êtes éliminé et ne pouvez pas voter.';
    controls.voteList.innerHTML = '';
    controls.voteSubmit.style.display = 'none';
    return showScreen('vote');
  }

  controls.voteInstruction.textContent = 'Votez pour éliminer un joueur vivant.';
  const listHtml = alivePlayers
    .filter(p => p.id !== state.playerId)
    .map(player => `<button class="secondary-btn" data-vote="${player.id}">${player.name}</button>`)
    .join('');
  controls.voteList.innerHTML = listHtml;
  controls.voteSubmit.style.display = 'block';
  showScreen('vote');
  Array.from(controls.voteList.querySelectorAll('button')).forEach(btn => {
    btn.addEventListener('click', () => {
      selectVote(btn.dataset.vote, btn);
    });
  });
}

function selectVote(targetId, button) {
  controls.voteList.querySelectorAll('button').forEach(btn => btn.classList.remove('selected'));
  button.classList.add('selected');
  controls.voteSubmit.dataset.selected = targetId;
}

function submitVote() {
  const targetId = controls.voteSubmit.dataset.selected;
  if (!targetId) return alert('Sélectionnez un joueur.');

  const updates = {};
  updates[`rooms/${state.roomCode}/votes/${state.playerId}`] = targetId;
  update(ref(database, '/'), updates).then(() => {
    controls.voteInstruction.textContent = 'Vote enregistré. Attendez le résultat.';
    controls.voteList.innerHTML = '';
    controls.voteSubmit.style.display = 'none';
    if (state.isHost) {
      setTimeout(() => evaluateVote(), 1200);
    }
  });
}

function evaluateVote() {
  get(state.roomRef).then(snapshot => {
    const room = snapshot.val();
    if (!room || room.phase !== 'vote') return;
    const votes = room.votes || {};
    const players = room.players || {};
    const quobidoLinks = room.quobidoLinks || {};
    const alive = Object.entries(players).filter(([, p]) => p.alive);

    if (Object.keys(votes).length < alive.length - 1) {
      return;
    }

    const voteCount = {};
    Object.values(votes).forEach(playerId => {
      voteCount[playerId] = (voteCount[playerId] || 0) + 1;
    });

    let maxVotes = 0;
    let chosen = null;
    Object.entries(voteCount).forEach(([id, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        chosen = id;
      } else if (count === maxVotes) {
        chosen = null;
      }
    });

    const updates = {
      [`rooms/${state.roomCode}/votes`]: null,
      [`rooms/${state.roomCode}/phase`]: 'result',
      [`rooms/${state.roomCode}/voteResults/eliminated`]: chosen || null,
      [`rooms/${state.roomCode}/voteResults/counts`]: voteCount
    };

    if (chosen && players[chosen]) {
      players[chosen].alive = false;      if (quobidoLinks[chosen]) {
        players[quobidoLinks[chosen]].alive = false;
      }      updates[`rooms/${state.roomCode}/players`] = players;
      updates[`rooms/${state.roomCode}/resultMessage`] = `${players[chosen].name} a été éliminé.e. Rôle : ${formatRole(players[chosen].role)}.`;
    } else {
      updates[`rooms/${state.roomCode}/resultMessage`] = 'Aucune majorité claire. Personne n’est éliminé.e.';
    }

    update(ref(database, '/'), updates).then(() => {
      checkEndConditions(roomCode => get(ref(database, `rooms/${roomCode}`)));
    });
  });
}

function renderResult(room) {
  controls.resultMessage.textContent = room.resultMessage || 'Résultat en attente.';
  showScreen('result');
}

function goToNextPhase() {
  get(state.roomRef).then(snapshot => {
    const room = snapshot.val();
    if (!room) return;
    const players = room.players || {};
    const gameOver = computeWinner(players);
    if (gameOver) {
      update(state.roomRef, { phase: 'ended', winner: gameOver });
      return;
    }
    update(state.roomRef, { phase: 'night', nightActions: null, resultMessage: null });
  });
}

function computeWinner(players) {
  const alive = Object.values(players).filter(p => p.alive);
  const mafiaCount = alive.filter(p => p.role === 'mafia').length;
  const citizenCount = alive.length - mafiaCount;
  if (mafiaCount === 0) return 'citoyens';
  if (mafiaCount >= citizenCount) return 'mafia';
  return null;
}

function renderGameOver(room, players) {
  const winner = room.winner;
  controls.gameOverMessage.textContent = winner === 'mafia'
    ? 'La Mafia gagne !'
    : 'Les Citoyens gagnent !';
  const detailsList = Object.values(players || {}).map(player => `• ${player.name} — ${formatRole(player.role)} — ${player.alive ? 'Vivant' : 'Éliminé'}`).join('<br>');
  controls.finalDetails.innerHTML = detailsList;
  showScreen('over');
}

function formatRole(role) {
  switch (role) {
    case 'mafia': return 'Mafia';
    case 'doctor': return 'Docteur';
    case 'detective': return 'Détective';
    case 'quobido': return 'Quobido';
    case 'citizen': return 'Citoyen';
    default: return 'Joueur';
  }
}

function getRoleDescription(role) {
  switch (role) {
    case 'mafia': return 'La nuit, tu choisis une victime secrète.';
    case 'doctor': return 'La nuit, tu peux protéger un joueur.';
    case 'detective': return 'La nuit, tu enquêtes sur un joueur.';
    case 'quobido': return 'La nuit, tu lies une personne à toi. Si tu meurs, elle meurt aussi (et vice-versa).';
    case 'citizen': return 'Reste silencieux.se pendant la nuit. Défends-toi le jour.';
    default: return 'Attends le début de la partie.';
  }
}

function checkEndConditions(fetchRoom) {
  const roomCode = state.roomCode;
  if (!roomCode) return;
  fetchRoom(roomCode).then(snapshot => {
    const room = snapshot.val();
    if (!room) return;
    const winner = computeWinner(room.players || {});
    if (winner) {
      update(ref(database, `rooms/${roomCode}`), { phase: 'ended', winner });
    }
  });
}

function leaveRoom() {
  if (!state.roomCode) return resetToWelcome();
  remove(ref(database, `rooms/${state.roomCode}/players/${state.playerId}`));
  resetToWelcome();
}

function resetToWelcome() {
  if (state.roomRef) {
    state.roomRef.off();
  }
  state.roomCode = null;
  state.roomRef = null;
  state.playerName = null;
  state.isHost = false;
  state.hasVoted = false;
  state.hasNightAction = false;
  controls.joinName.value = '';
  controls.joinCode.value = '';
  showScreen('welcome');
}

showScreen('welcome');
