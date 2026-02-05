// communityService.js - TouchBase backend services
// Updated with user profile and display name support

import { db, auth } from './firebase';
import {
  collection,
  addDoc,
  doc,
  setDoc,
  updateDoc,
  writeBatch,
  arrayUnion,
  query,
  where,
  getDocs,
  getDoc,
  serverTimestamp
} from 'firebase/firestore';

// ═══════════════════════════════════════════════════════════════════════════════
// USER PROFILE & DISPLAY NAME SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

// In-memory cache for display names (survives across component renders)
const displayNameCache = new Map();

// Mock user names
const MOCK_NAMES = {
  'mock_user_1_sarah': 'Sarah Chen',
  'mock_user_2_mike': 'Mike Rodriguez',
  'mock_user_3_jessica': 'Jessica Kim',
  'mock_user_4_alex': 'Alex Thompson'
};

// Create or update user profile in Firestore
// Call this after signup and optionally on login
export const saveUserProfile = async (userId, displayName) => {
  if (!userId || !displayName) return;
  
  const userRef = doc(db, 'users', userId);
  await setDoc(userRef, {
    displayName,
    updatedAt: serverTimestamp()
  }, { merge: true });
  
  // Update cache immediately
  displayNameCache.set(userId, displayName);
};

// Fetch a single user's display name (async, with caching)
export const fetchUserDisplayName = async (userId) => {
  if (!userId) return null;
  
  // Check mock users first
  if (MOCK_NAMES[userId]) {
    displayNameCache.set(userId, MOCK_NAMES[userId]);
    return MOCK_NAMES[userId];
  }
  
  // Check cache
  if (displayNameCache.has(userId)) {
    return displayNameCache.get(userId);
  }
  
  // Fetch from Firestore
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const name = userSnap.data().displayName || userId;
      displayNameCache.set(userId, name);
      return name;
    }
  } catch (e) {
    console.log('fetchUserDisplayName error:', e.message);
  }
  
  // Fallback to userId
  displayNameCache.set(userId, userId);
  return userId;
};

// Fetch multiple users' display names at once (more efficient)
export const fetchUserDisplayNames = async (userIds) => {
  if (!userIds || userIds.length === 0) return;
  
  const uncached = userIds.filter(id => {
    // Skip if already cached or is a mock user
    if (displayNameCache.has(id)) return false;
    if (MOCK_NAMES[id]) {
      displayNameCache.set(id, MOCK_NAMES[id]);
      return false;
    }
    return true;
  });
  
  if (uncached.length === 0) return;
  
  // Fetch all uncached users
  // Note: Firestore 'in' queries limited to 30 items, so chunk if needed
  const chunks = [];
  for (let i = 0; i < uncached.length; i += 30) {
    chunks.push(uncached.slice(i, i + 30));
  }
  
  for (const chunk of chunks) {
    try {
      const q = query(
        collection(db, 'users'),
        where('__name__', 'in', chunk)
      );
      const snap = await getDocs(q);
      
      snap.docs.forEach(docSnap => {
        const name = docSnap.data().displayName || docSnap.id;
        displayNameCache.set(docSnap.id, name);
      });
      
      // For any users not found in Firestore, cache their ID as fallback
      chunk.forEach(id => {
        if (!displayNameCache.has(id)) {
          displayNameCache.set(id, id);
        }
      });
    } catch (e) {
      console.log('fetchUserDisplayNames error:', e.message);
      // Fallback: cache IDs for failed fetches
      chunk.forEach(id => {
        if (!displayNameCache.has(id)) {
          displayNameCache.set(id, id);
        }
      });
    }
  }
};

// Get display name synchronously from cache
// Call fetchUserDisplayNames first to populate cache
export const getUserDisplayName = (userId) => {
  if (!userId) return 'Unknown';
  
  // Check mock users
  if (MOCK_NAMES[userId]) return MOCK_NAMES[userId];
  
  // Check cache
  if (displayNameCache.has(userId)) {
    return displayNameCache.get(userId);
  }
  
  // Not in cache yet - return shortened ID as placeholder
  return userId.slice(0, 8) + '...';
};

// Clear cache (call on logout)
export const clearDisplayNameCache = () => {
  displayNameCache.clear();
};

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK USER HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

// Simple helper to detect mock "bot" users
const isMockUser = (userId = '') => userId.startsWith('mock_user_');

export const isGameBot = (game) => {
  const flag = game?.isBotOpponent ?? game?.botOpponent;
  if (typeof flag === 'boolean') return flag;
  return (game?.player1Id?.startsWith?.('mock_user_') ||
          game?.player2Id?.startsWith?.('mock_user_')) || false;
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMMUNITY MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

// Generate unique 7-character invite code
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

// Get community members
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

// ═══════════════════════════════════════════════════════════════════════════════
// GAME MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

// Who am I in this game?
const whoAmI = (game, uid) => (game.player1Id === uid ? 'player1' : 'player2');

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
    consequencesPersisted: null,
    isBotOpponent: botOpponent,
    botOpponent: botOpponent,
  };

  const docRef = await addDoc(collection(db, 'games'), game);
  if (botOpponent) await autoFillMockPlayer(docRef.id);
  return { id: docRef.id, ...game };
};

// List games where I am player1 or player2
export const getMyGames = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be logged in');

  const gamesCol = collection(db, 'games');
  const q1 = query(gamesCol, where('player1Id', '==', user.uid));
  const q2 = query(gamesCol, where('player2Id', '==', user.uid));

  const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
  const list = [...s1.docs, ...s2.docs].map(d => ({ id: d.id, ...d.data() }));

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
  
  await checkGameProgress(gameId);
};

// Reveal my actual most-recent contact
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
  
  await checkGameProgress(gameId);
};

// ═══════════════════════════════════════════════════════════════════════════════
// GAME STATE PROGRESSION & RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════════

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
      winner = 'tie';
      consequences.push({
        type: 'joint',
        description: 'Both players donate to charity or attend community event',
        player1Id: game.player1Id,
        player2Id: game.player2Id
      });
    } else if (p1Correct && !p2Correct) {
      outcome = 'player1_correct';
      winner = 'player1';
      consequences.push({
        type: 'owed',
        fromPlayer: game.player2Id,
        toPlayer: game.player1Id,
        description: 'Call or meet up as agreed'
      });
    } else if (!p1Correct && p2Correct) {
      outcome = 'player2_correct';
      winner = 'player2';
      consequences.push({
        type: 'owed',
        fromPlayer: game.player1Id,
        toPlayer: game.player2Id,
        description: 'Call or meet up as agreed'
      });
    } else {
      outcome = 'both_wrong';
      winner = 'none';
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
    
    // Persist outcome + consequences atomically
    const batch = writeBatch(db);

    batch.update(gameRef, {
      outcome,
      winner,
      consequences,
      status: 'completed',
      gameCompletedAt: serverTimestamp(),
      consequencesPersisted: true
    });

    const communityId = game.communityId || null;

    for (const c of consequences) {
      if (c.type === 'owed') {
        const fromPlayer = c.fromPlayer;
        const toPlayer = c.toPlayer;
        const id = `${gameId}_${fromPlayer}_${toPlayer}_owed`;
        const cRef = doc(db, 'consequences', id);
        batch.set(cRef, {
          id,
          fromGameId: gameId,
          communityId,
          playerId: fromPlayer,
          targetId: toPlayer,
          type: 'owed',
          description: c.description || 'Reconnect as agreed',
          completed: false,
          completedAt: null,
          proofText: null,
          createdAt: serverTimestamp()
        }, { merge: true });
      }

      if (c.type === 'joint') {
        const p1 = c.player1Id;
        const p2 = c.player2Id;
        const desc = c.description || 'Do a joint positive gesture together';

        batch.set(doc(db, 'consequences', `${gameId}_${p1}_joint`), {
          id: `${gameId}_${p1}_joint`,
          fromGameId: gameId,
          communityId,
          playerId: p1,
          targetId: p2,
          type: 'joint',
          description: desc,
          completed: false,
          completedAt: null,
          proofText: null,
          createdAt: serverTimestamp()
        }, { merge: true });

        batch.set(doc(db, 'consequences', `${gameId}_${p2}_joint`), {
          id: `${gameId}_${p2}_joint`,
          fromGameId: gameId,
          communityId,
          playerId: p2,
          targetId: p1,
          type: 'joint',
          description: desc,
          completed: false,
          completedAt: null,
          proofText: null,
          createdAt: serverTimestamp()
        }, { merge: true });
      }
    }

    await batch.commit();
    return { outcome, winner, consequences };
  }
};

// Auto-fill mock player's moves for testing
export const autoFillMockPlayer = async (gameId) => {
  const gameRef = doc(db, 'games', gameId);
  const gameSnap = await getDoc(gameRef);
  
  if (!gameSnap.exists()) return;
  
  const game = gameSnap.data();
  
  const isMockPlayer2 = isMockUser(game?.player2Id || '');
  const isMockPlayer1 = isMockUser(game?.player1Id || '');
  
  if (!isMockPlayer1 && !isMockPlayer2) return;
  
  const { community } = await getCommunityMembers(game.communityId);
  const validMembers = community.members.filter(m => m !== game.player1Id && m !== game.player2Id);
  
  if (validMembers.length === 0) return;
  
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

// Convenience reads
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

// ═══════════════════════════════════════════════════════════════════════════════
// CONSEQUENCES
// ═══════════════════════════════════════════════════════════════════════════════

export const getConsequencesOwedByMe = async (includeCompleted = false) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be logged in');

  const q = query(collection(db, 'consequences'), where('playerId', '==', user.uid));
  const snap = await getDocs(q);
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const filtered = includeCompleted ? items : items.filter(x => !x.completed);

  filtered.sort((a, b) => {
    const at = a.createdAt?.toMillis?.() || 0;
    const bt = b.createdAt?.toMillis?.() || 0;
    return bt - at;
  });

  return filtered;
};

export const getConsequencesOwedToMe = async (includeCompleted = false) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be logged in');

  const q = query(collection(db, 'consequences'), where('targetId', '==', user.uid));
  const snap = await getDocs(q);
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const filtered = includeCompleted ? items : items.filter(x => !x.completed);

  filtered.sort((a, b) => {
    const at = a.createdAt?.toMillis?.() || 0;
    const bt = b.createdAt?.toMillis?.() || 0;
    return bt - at;
  });

  return filtered;
};

export const completeConsequence = async (consequenceId, proofText = null) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be logged in');

  const ref = doc(db, 'consequences', consequenceId);
  const snap = await getDoc(ref);

  if (!snap.exists()) throw new Error('Consequence not found');

  const c = snap.data();
  if (c.targetId !== user.uid) throw new Error('Only the person owed can confirm a consequence is complete');

  await updateDoc(ref, {
    completed: true,
    completedAt: serverTimestamp(),
    proofText: proofText || null
  });

  return true;
};