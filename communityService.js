// This is my communityService.js file which holds a lot of the components and const that are called from the app.js file

import { db, auth } from './firebase';
import { 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  arrayUnion, 
  query, 
  where, 
  getDocs,
  getDoc,
  serverTimestamp
} from 'firebase/firestore';

// Simple helper to detect mock "bot" users
const isMockUser = (userId = '') => userId.startsWith('mock_user_');
export const isGameBot = (game) => {
  const flag = game?.isBotOpponent ?? game?.botOpponent;
  if (typeof flag === 'boolean') return flag;
  // Fallback to checking IDs (covers old docs without the flag)
  return (game?.player1Id?.startsWith?.('mock_user_') ||
          game?.player2Id?.startsWith?.('mock_user_')) || false;
};

// Generate unique 7-character invite code (React Native compatible)
export const generateInviteCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 7; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Create new community
export const createCommunity = async (name, description) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be logged in');

  const inviteCode = generateInviteCode();
  
  const community = {
    name,
    description,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    inviteCode,
    members: [user.uid],
    isActive: true
  };

  const docRef = await addDoc(collection(db, 'communities'), community);
  return { id: docRef.id, ...community };
};

// Join existing community by invite code
export const joinCommunity = async (inviteCode) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be logged in');
  const q = query(collection(db, 'communities'), where('inviteCode', '==', inviteCode.toUpperCase()));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('Invalid invite code');

  const communityDoc = snap.docs[0];
  const data = communityDoc.data();
  if (data.members.includes(user.uid)) throw new Error('You are already a member of this community');

  await updateDoc(doc(db, 'communities', communityDoc.id), { members: arrayUnion(user.uid) });
  return { id: communityDoc.id, ...data };
};

// Get communities where user is a member
export const getUserCommunities = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be logged in');

  const q = query(collection(db, 'communities'), where('members', 'array-contains', user.uid));
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

// Create new game between two players
export const createGame = async (communityId, opponentId) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be logged in');

  const botOpponent = isMockUser(opponentId);

  const game = {
    communityId,
    player1Id: user.uid,
    player2Id: opponentId,
    status: 'active',
    createdAt: serverTimestamp(),
    player1Guess: null,
    player2Guess: null,
    player1GuessSubmittedAt: null,
    player2GuessSubmittedAt: null,
    player1ActualContact: null,
    player2ActualContact: null,
    player1RevealedAt: null,
    player2RevealedAt: null,
    winner: null,
    outcome: null,
    gameCompletedAt: null,
    consequences: [],
    // write both for backwards compatibility
    isBotOpponent: botOpponent,
    botOpponent: botOpponent,
  };

  const docRef = await addDoc(collection(db, 'games'), game);
  if (botOpponent) await autoFillMockPlayer(docRef.id);
  return { id: docRef.id, ...game };
};


// Get community members (updated version)
export const getCommunityMembers = async (communityId) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be logged in');

  const communityRef = doc(db, 'communities', communityId);
  const communitySnap = await getDoc(communityRef);
  
  if (!communitySnap.exists()) {
    throw new Error('Community not found');
  }

  const community = communitySnap.data();
  const otherMembers = community.members.filter(memberId => memberId !== user.uid);
  
  return {
    community: { id: communityId, ...community },
    availableOpponents: otherMembers
  };
};

// Add mock members to community for testing (temporary)
export const addMockMembers = async (communityId) => {
  const mockMembers = [
    'mock_user_1_sarah',
    'mock_user_2_mike', 
    'mock_user_3_jessica',
    'mock_user_4_alex'
  ];

  const communityRef = doc(db, 'communities', communityId);
  await updateDoc(communityRef, {
    members: arrayUnion(...mockMembers)
  });

  return mockMembers;
};

// Get mock member display names
export const getMockMemberName = (userId) => {
  const names = {
    'mock_user_1_sarah': 'Sarah Chen',
    'mock_user_2_mike': 'Mike Rodriguez', 
    'mock_user_3_jessica': 'Jessica Kim',
    'mock_user_4_alex': 'Alex Thompson'
  };
  return names[userId] || userId;
};

// Who am I in this game?
const whoAmI = (game, uid) => (game.player1Id === uid ? 'player1' : 'player2');

// List games where I am player1 or player2 and still active/in-progress
export const getMyGames = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be logged in');

  // Two simple queries (player1 OR player2), then merge
  const gamesCol = collection(db, 'games');

  const q1 = query(gamesCol, where('player1Id', '==', user.uid));
  const q2 = query(gamesCol, where('player2Id', '==', user.uid));

  const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
  const list = [...s1.docs, ...s2.docs].map(d => ({ id: d.id, ...d.data() }));

  // Optional filter by status if you want:
  // return list.filter(g => g.status !== 'completed');
  return list;
};

// Submit my guess (which member I think contacted the opponent)
export const submitMyGuess = async (gameId, guessedMemberId) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be logged in');

  const gameRef = doc(db, 'games', gameId);
  const gameSnap = await getDoc(gameRef);
  
  if (!gameSnap.exists()) throw new Error('Game not found');
  
  const game = gameSnap.data();
  const me = whoAmI(game, user.uid);
  const fieldGuess = me === 'player1' ? 'player1Guess' : 'player2Guess';
  const fieldTime = me === 'player1' ? 'player1GuessSubmittedAt' : 'player2GuessSubmittedAt';

  await updateDoc(gameRef, {
    [fieldGuess]: guessedMemberId,
    [fieldTime]: serverTimestamp()
  });
  
  // Check if game is complete
  await checkGameProgress(gameId);
};

// Reveal my actual most-recent contact (manual pick from member list)
export const submitMyActualContact = async (gameId, actualMemberId) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be logged in');

  const gameRef = doc(db, 'games', gameId);
  const gameSnap = await getDoc(gameRef);
  
  if (!gameSnap.exists()) throw new Error('Game not found');
  
  const game = gameSnap.data();
  const me = whoAmI(game, user.uid);
  const fieldActual = me === 'player1' ? 'player1ActualContact' : 'player2ActualContact';
  const fieldTime = me === 'player1' ? 'player1RevealedAt' : 'player2RevealedAt';

  await updateDoc(gameRef, {
    [fieldActual]: actualMemberId,
    [fieldTime]: serverTimestamp()
  });
  
  // Check if game is complete
  await checkGameProgress(gameId);
};

// --- Game state progression & resolution ---

// Re-evaluate game phase and compute results when ready
  const checkGameProgress = async (gameId) => {
  const gameRef = doc(db, 'games', gameId);
  const gameSnap = await getDoc(gameRef);
  
  if (!gameSnap.exists()) return;
  
  const game = gameSnap.data();
  const bothGuessed = Boolean(game.player1Guess && game.player2Guess);
  const bothRevealed = Boolean(game.player1ActualContact && game.player2ActualContact);

  // Advance status when both guesses are in but reveals are pending
  if (bothGuessed && !bothRevealed && game.status !== 'guessing_complete') {
    await updateDoc(gameRef, { status: 'guessing_complete' });
    return;
  }
  
  // Check if both players have submitted guesses and reveals
  if (bothGuessed && bothRevealed && !game.outcome) {
    
    // Calculate outcome
    const p1Correct = game.player1Guess === game.player2ActualContact;
    const p2Correct = game.player2Guess === game.player1ActualContact;
    
    let outcome, winner;
    const consequences = [];
    
    if (p1Correct && p2Correct) {
      outcome = 'both_correct';
      winner = 'tie'; // both right → joint positive gesture
      // Both players do something positive together
      consequences.push({
        type: 'joint',
        description: 'Both players donate to charity or attend community event',
        player1Id: game.player1Id,
        player2Id: game.player2Id
      });
    } else if (p1Correct && !p2Correct) {
      outcome = 'player1_correct';
      winner = 'player1';
      // Player 2 owes consequence to player 1
      consequences.push({
        type: 'owed',
        fromPlayer: game.player2Id,
        toPlayer: game.player1Id,
        description: 'Call or meet up as agreed'
      });
    } else if (!p1Correct && p2Correct) {
      outcome = 'player2_correct';
      winner = 'player2';
      // Player 1 owes consequence to player 2
      consequences.push({
        type: 'owed',
        fromPlayer: game.player1Id,
        toPlayer: game.player2Id,
        description: 'Call or meet up as agreed'
      });
    } else {
      outcome = 'both_wrong';
      winner = 'none'; // clearer downstream handling
      // Both owe consequences to the people they guessed
      consequences.push({
        type: 'owed',
        fromPlayer: game.player1Id,
        toPlayer: game.player2Guess,
        description: 'Reconnect with the person you guessed'
      });
      consequences.push({
        type: 'owed',
        fromPlayer: game.player2Id,
        toPlayer: game.player1Guess,
        description: 'Reconnect with the person you guessed'
      });
    }
    
    // Update game with outcome
    await updateDoc(gameRef, {
      outcome,
      winner,
      consequences,
      status: 'completed',
      gameCompletedAt: serverTimestamp()
    });
    
    return { outcome, winner, consequences };
  }
};

// For testing: Auto-fill mock player's moves
export const autoFillMockPlayer = async (gameId) => {
  const gameRef = doc(db, 'games', gameId);
  const gameSnap = await getDoc(gameRef);
  
  if (!gameSnap.exists()) return;
  
  const game = gameSnap.data();
  const currentUserId = auth.currentUser?.uid;
  
  // Determine which player is the mock
  const isMockPlayer2 = isMockUser(game?.player2Id || '');
  const isMockPlayer1 = isMockUser(game?.player1Id || '');
  
  if (!isMockPlayer1 && !isMockPlayer2) return;
  
  // Get community members for valid choices
  const { community } = await getCommunityMembers(game.communityId);
  const validMembers = community.members.filter(m => m !== game.player1Id && m !== game.player2Id);
  
  if (validMembers.length === 0) return;
  
  // Random selection for mock player
  const randomMember = validMembers[Math.floor(Math.random() * validMembers.length)];
  
  const updates = {};
  
  if (isMockPlayer2 && !game.player2Guess) {
    updates.player2Guess = randomMember;
    updates.player2GuessSubmittedAt = serverTimestamp();
  }
  
  if (isMockPlayer2 && !game.player2ActualContact) {
    updates.player2ActualContact = randomMember;
    updates.player2RevealedAt = serverTimestamp();
  }
  
  if (isMockPlayer1 && !game.player1Guess) {
    updates.player1Guess = randomMember;
    updates.player1GuessSubmittedAt = serverTimestamp();
  }
  
  if (isMockPlayer1 && !game.player1ActualContact) {
    updates.player1ActualContact = randomMember;
    updates.player1RevealedAt = serverTimestamp();
  }
  
  if (Object.keys(updates).length > 0) {
    await updateDoc(gameRef, updates);
    await checkGameProgress(gameId);
  }
};

// Convenience reads (optional but handy in App.js)
export const getGame = async (gameId) => {
  const ref = doc(db, 'games', gameId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Game not found');
  return { id: snap.id, ...snap.data() };
};

export const listActiveGamesForUser = async () => {
  const games = await getMyGames();
  return games.filter(g => g.status !== 'completed');
};

export const listGameHistoryForUser = async () => {
  const games = await getMyGames();
  return games.filter(g => g.status === 'completed');
};
