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
  getDoc 
} from 'firebase/firestore';

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
    createdAt: new Date(),
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

  // Find community with matching invite code
  const q = query(collection(db, 'communities'), where('inviteCode', '==', inviteCode.toUpperCase()));
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) {
    throw new Error('Invalid invite code');
  }

  const communityDoc = querySnapshot.docs[0];
  const communityData = communityDoc.data();
  
  // Check if user is already a member
  if (communityData.members.includes(user.uid)) {
    throw new Error('You are already a member of this community');
  }

  // Add user to community members
  await updateDoc(doc(db, 'communities', communityDoc.id), {
    members: arrayUnion(user.uid)
  });

  return { id: communityDoc.id, ...communityData };
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

  const game = {
    communityId,
    player1Id: user.uid,
    player2Id: opponentId,
    status: 'active',
    createdAt: new Date(),
    player1Guess: null,
    player2Guess: null,
    player1GuessSubmittedAt: null,
    player2GuessSubmittedAt: null,
    player1ActualContact: null,
    player2ActualContact: null,
    player1RevealedAt: null,
    player2RevealedAt: null,
    winner: null,
    gameCompletedAt: null,
    consequences: []
  };

  const docRef = await addDoc(collection(db, 'games'), game);
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

import { serverTimestamp } from 'firebase/firestore';

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
export const submitMyGuess = async (game) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be logged in');

  const me = whoAmI(game, user.uid);
  const fieldGuess = me === 'player1' ? 'player1Guess' : 'player2Guess';
  const fieldTime = me === 'player1' ? 'player1GuessSubmittedAt' : 'player2GuessSubmittedAt';

  // For MVP we’ll just set the guess; UI will pass the selected memberId
  return async (memberId) => {
    await updateDoc(doc(db, 'games', game.id), {
      [fieldGuess]: memberId,
      [fieldTime]: serverTimestamp(),
      status: 'active', // keep status simple for now
    });
  };
};

// Reveal my actual most-recent contact (manual pick from member list)
export const submitMyActualContact = async (game) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be logged in');

  const me = whoAmI(game, user.uid);
  const fieldActual = me === 'player1' ? 'player1ActualContact' : 'player2ActualContact';
  const fieldTime = me === 'player1' ? 'player1RevealedAt' : 'player2RevealedAt';

  return async (memberId) => {
    await updateDoc(doc(db, 'games', game.id), {
      [fieldActual]: memberId,
      [fieldTime]: serverTimestamp(),
    });
  };
};
